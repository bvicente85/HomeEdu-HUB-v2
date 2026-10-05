-- =============================================================================
-- Migration: Phase 2B.1 Student Learning State Hardening & Domain Integrity
-- Date: 2026-10-05
-- Targets:
--   - public.learning_state_history (Audit immutability, ON DELETE SET NULL)
--   - public.diagnostic_targets (Entity presence check constraint)
--   - public.assessment_attempts (Semantic relational cross-validation trigger)
--   - public.diagnostic_sessions (Student subject ownership validation trigger)
--   - public.record_parent_learning_override (Atomic state + history transition RPC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DIAGNOSTIC TARGET INTEGRITY
-- Enforce that a diagnostic target must reference a learning objective or a concept
-- -----------------------------------------------------------------------------

ALTER TABLE public.diagnostic_targets
DROP CONSTRAINT IF EXISTS chk_diag_target_has_entity;

ALTER TABLE public.diagnostic_targets
ADD CONSTRAINT chk_diag_target_has_entity
CHECK (learning_objective_id IS NOT NULL OR concept_id IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 2. LEARNING STATE HISTORY AUDIT TRAIL PROTECTION
-- History records must survive if a current learning state row is removed.
-- -----------------------------------------------------------------------------

ALTER TABLE public.learning_state_history
DROP CONSTRAINT IF EXISTS learning_state_history_learning_state_id_fkey;

ALTER TABLE public.learning_state_history
ALTER COLUMN learning_state_id DROP NOT NULL;

ALTER TABLE public.learning_state_history
ADD CONSTRAINT learning_state_history_learning_state_id_fkey
FOREIGN KEY (learning_state_id)
REFERENCES public.student_learning_states(id)
ON DELETE SET NULL;

-- Trigger: Ensure learning_state_history is strictly immutable (no UPDATE or DELETE)
CREATE OR REPLACE FUNCTION public.prevent_learning_state_history_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit trail violation: records in learning_state_history are immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_learning_state_history ON public.learning_state_history;
CREATE TRIGGER trg_protect_learning_state_history
    BEFORE UPDATE OR DELETE ON public.learning_state_history
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_learning_state_history_modification();

-- -----------------------------------------------------------------------------
-- 3. ASSESSMENT ATTEMPTS SEMANTIC CROSS-VALIDATION
-- Prevent students from associating unrelated evidence, items, or sessions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_assessment_attempt_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Student identity check for authenticated students
    IF auth.uid() IS NOT NULL THEN
        -- If user is student, they can only record attempts for themselves
        IF NOT public.can_modify_student(NEW.student_id) THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.students s
                WHERE s.id = NEW.student_id AND s.profile_id = auth.uid()
            ) THEN
                RAISE EXCEPTION 'Students can only record assessment attempts for their own profile.';
            END IF;
        END IF;
    END IF;

    -- 2. Diagnostic session must belong to the same student
    IF NEW.diagnostic_session_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.diagnostic_sessions ds
            WHERE ds.id = NEW.diagnostic_session_id AND ds.student_id = NEW.student_id
        ) THEN
            RAISE EXCEPTION 'Diagnostic session % does not belong to student %',
                NEW.diagnostic_session_id, NEW.student_id;
        END IF;
    END IF;

    -- 3. Evidence must belong to the same student and learning objective
    IF NEW.evidence_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.learning_evidence le
            WHERE le.id = NEW.evidence_id
              AND le.student_id = NEW.student_id
              AND le.learning_objective_id = NEW.learning_objective_id
        ) THEN
            RAISE EXCEPTION 'Evidence % does not match student % and objective %',
                NEW.evidence_id, NEW.student_id, NEW.learning_objective_id;
        END IF;
    END IF;

    -- 4. Assessment item, if supplied, must correspond to the learning objective
    IF NEW.assessment_item_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.assessment_items ai
            WHERE ai.id = NEW.assessment_item_id
              AND (ai.learning_objective_id IS NULL OR ai.learning_objective_id = NEW.learning_objective_id)
        ) THEN
            RAISE EXCEPTION 'Assessment item % does not map to learning objective %',
                NEW.assessment_item_id, NEW.learning_objective_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_assessment_attempt_integrity ON public.assessment_attempts;
CREATE TRIGGER trg_check_assessment_attempt_integrity
    BEFORE INSERT OR UPDATE ON public.assessment_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.check_assessment_attempt_integrity();

-- -----------------------------------------------------------------------------
-- 4. DIAGNOSTIC SESSION INTEGRITY
-- Validate that student_subject_id belongs to the same student
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_diagnostic_session_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.student_subject_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.student_subjects ss
            WHERE ss.id = NEW.student_subject_id AND ss.student_id = NEW.student_id
        ) THEN
            RAISE EXCEPTION 'Student subject % does not belong to student %',
                NEW.student_subject_id, NEW.student_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_diagnostic_session_integrity ON public.diagnostic_sessions;
CREATE TRIGGER trg_check_diagnostic_session_integrity
    BEFORE INSERT OR UPDATE ON public.diagnostic_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_diagnostic_session_integrity();

-- -----------------------------------------------------------------------------
-- 5. ATOMIC STATE & HISTORY TRANSITION RPC
-- Guarantees atomic parent override: state update + evidence + history
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_parent_learning_override(
    p_student_id UUID,
    p_learning_objective_id UUID,
    p_new_mastery_state VARCHAR(32),
    p_new_gap_status VARCHAR(32),
    p_confidence_level VARCHAR(16),
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prev_mastery VARCHAR(32) := NULL;
    v_prev_gap VARCHAR(32) := NULL;
    v_prev_evidence_count INT := 0;
    v_existing_state_id UUID := NULL;
    v_existing_last_demonstrated TIMESTAMPTZ := NULL;
    v_new_demonstrated TIMESTAMPTZ := NULL;
    v_evidence_id UUID;
    v_state_id UUID;
    v_history_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_result_status VARCHAR(32);
    v_updated_state RECORD;
    v_inserted_evidence RECORD;
    v_inserted_history RECORD;
BEGIN
    -- Authorization check
    IF NOT public.can_modify_student(p_student_id) THEN
        RAISE EXCEPTION 'Access denied: caller is not an authorized parent for student %', p_student_id;
    END IF;

    -- Parameter validation
    IF p_new_mastery_state NOT IN ('NOT_ASSESSED', 'EMERGING', 'DEVELOPING', 'SECURE', 'MASTERED') THEN
        RAISE EXCEPTION 'Invalid mastery_state: %', p_new_mastery_state;
    END IF;

    IF p_new_gap_status NOT IN ('NO_DATA', 'ON_TRACK', 'DEVELOPING', 'GAP', 'PREREQUISITE_GAP') THEN
        RAISE EXCEPTION 'Invalid gap_status: %', p_new_gap_status;
    END IF;

    IF p_confidence_level NOT IN ('LOW', 'MEDIUM', 'HIGH') THEN
        RAISE EXCEPTION 'Invalid confidence_level: %', p_confidence_level;
    END IF;

    -- Fetch current state if it exists
    SELECT id, mastery_state, gap_status, evidence_count, last_demonstrated_at
    INTO v_existing_state_id, v_prev_mastery, v_prev_gap, v_prev_evidence_count, v_existing_last_demonstrated
    FROM public.student_learning_states
    WHERE student_id = p_student_id
      AND learning_objective_id = p_learning_objective_id;

    -- Determine demonstration status
    IF p_new_mastery_state IN ('SECURE', 'MASTERED') THEN
        v_result_status := 'DEMONSTRATED';
        v_new_demonstrated := v_now;
    ELSIF p_new_mastery_state IN ('EMERGING', 'DEVELOPING') THEN
        v_result_status := 'PARTIALLY_DEMONSTRATED';
        v_new_demonstrated := v_existing_last_demonstrated;
    ELSE
        v_result_status := 'NOT_DEMONSTRATED';
        v_new_demonstrated := v_existing_last_demonstrated;
    END IF;

    v_evidence_id := gen_random_uuid();
    v_history_id := gen_random_uuid();
    v_state_id := COALESCE(v_existing_state_id, gen_random_uuid());

    -- 1. Insert Evidence Record
    INSERT INTO public.learning_evidence (
        id, student_id, learning_objective_id, evidence_type, support_level,
        result_status, reliability, source_reference, captured_at, notes, created_at
    ) VALUES (
        v_evidence_id, p_student_id, p_learning_objective_id, 'PARENT_OVERRIDE', 'INDEPENDENT',
        v_result_status, p_confidence_level, 'Parent Administrative Assessment', v_now, TRIM(p_notes), v_now
    ) RETURNING * INTO v_inserted_evidence;

    -- 2. Upsert Learning State Record
    INSERT INTO public.student_learning_states (
        id, student_id, learning_objective_id, mastery_state, gap_status,
        evidence_count, last_assessed_at, last_demonstrated_at,
        confidence_level, notes, created_at, updated_at
    ) VALUES (
        v_state_id, p_student_id, p_learning_objective_id, p_new_mastery_state, p_new_gap_status,
        v_prev_evidence_count + 1, v_now, v_new_demonstrated,
        p_confidence_level, TRIM(p_notes), v_now, v_now
    )
    ON CONFLICT (student_id, learning_objective_id) DO UPDATE SET
        mastery_state = EXCLUDED.mastery_state,
        gap_status = EXCLUDED.gap_status,
        evidence_count = public.student_learning_states.evidence_count + 1,
        last_assessed_at = EXCLUDED.last_assessed_at,
        last_demonstrated_at = COALESCE(EXCLUDED.last_demonstrated_at, public.student_learning_states.last_demonstrated_at),
        confidence_level = EXCLUDED.confidence_level,
        notes = EXCLUDED.notes,
        updated_at = v_now
    RETURNING * INTO v_updated_state;

    -- 3. Insert Immutable Audit History Record
    INSERT INTO public.learning_state_history (
        id, learning_state_id, student_id, learning_objective_id,
        previous_mastery_state, new_mastery_state,
        previous_gap_status, new_gap_status,
        change_reason, evidence_id, notes, created_at
    ) VALUES (
        v_history_id, v_state_id, p_student_id, p_learning_objective_id,
        v_prev_mastery, p_new_mastery_state,
        v_prev_gap, p_new_gap_status,
        'PARENT_OVERRIDE', v_evidence_id, TRIM(p_notes), v_now
    ) RETURNING * INTO v_inserted_history;

    RETURN jsonb_build_object(
        'state', to_jsonb(v_updated_state),
        'evidence', to_jsonb(v_inserted_evidence),
        'history', to_jsonb(v_inserted_history)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_parent_learning_override(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT) TO authenticated;
