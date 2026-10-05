-- =============================================================================
-- Migration: Phase 2D.3a Decision Schema & Service Layer
-- Date: 2026-10-05
-- Targets:
--   - public.student_priority_decisions (Current parent decision state)
--   - public.student_priority_decision_history (Immutable audit history ledger)
--   - public.prevent_priority_decision_history_modification (Immutability trigger)
--   - public.record_parent_priority_decision (Server-authoritative atomic RPC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CURRENT PRIORITY DECISION TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_priority_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_subject_id UUID NOT NULL REFERENCES public.student_subjects(id) ON DELETE CASCADE,
    learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    
    parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    
    decision_type TEXT NOT NULL CHECK (decision_type IN ('APPROVED', 'DEFERRED', 'OVERRIDDEN', 'EXCLUDED')),
    parent_priority_order INTEGER NULL,
    parent_notes TEXT NULL,
    
    system_tier_at_decision TEXT NOT NULL,
    system_rank_at_decision INTEGER NOT NULL,
    
    review_status TEXT NOT NULL DEFAULT 'CURRENT' CHECK (review_status IN ('CURRENT', 'REVIEW_RECOMMENDED')),
    state_hash_at_decision TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_student_objective_decision UNIQUE (student_id, learning_objective_id)
);

CREATE INDEX IF NOT EXISTS idx_student_priority_decisions_student ON public.student_priority_decisions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_priority_decisions_subject ON public.student_priority_decisions(student_subject_id);
CREATE INDEX IF NOT EXISTS idx_student_priority_decisions_lo ON public.student_priority_decisions(learning_objective_id);

-- -----------------------------------------------------------------------------
-- 2. IMMUTABLE DECISION HISTORY TABLE (APPEND-ONLY LEDGER)
-- Note: ON DELETE SET NULL on decision_id ensures history survives operational row removal.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_priority_decision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NULL REFERENCES public.student_priority_decisions(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_subject_id UUID NOT NULL REFERENCES public.student_subjects(id) ON DELETE CASCADE,
    learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    
    parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    
    previous_decision_type TEXT NULL,
    new_decision_type TEXT NOT NULL,
    
    previous_parent_order INTEGER NULL,
    new_parent_order INTEGER NULL,
    
    system_tier_at_event TEXT NOT NULL,
    system_rank_at_event INTEGER NOT NULL,
    
    reason TEXT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_history_student ON public.student_priority_decision_history(student_id);
CREATE INDEX IF NOT EXISTS idx_decision_history_lo ON public.student_priority_decision_history(learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_decision_history_timestamp ON public.student_priority_decision_history(event_timestamp);

-- -----------------------------------------------------------------------------
-- 3. IMMUTABILITY TRIGGER ON DECISION HISTORY
-- Strict database-level rejection of any UPDATE or DELETE operations
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_priority_decision_history_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit trail violation: records in student_priority_decision_history are immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_priority_decision_history ON public.student_priority_decision_history;
CREATE TRIGGER trg_protect_priority_decision_history
    BEFORE UPDATE OR DELETE ON public.student_priority_decision_history
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_priority_decision_history_modification();

-- -----------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.student_priority_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_priority_decision_history ENABLE ROW LEVEL SECURITY;

-- Decisions RLS: Parents can read decisions for their family's students
CREATE POLICY "Parents and students can read family priority decisions"
ON public.student_priority_decisions
FOR SELECT
USING (
    public.can_read_student(student_id)
);

-- Decisions RLS: Only authorized parents can modify decisions via controlled table actions
CREATE POLICY "Parents can insert family priority decisions"
ON public.student_priority_decisions
FOR INSERT
WITH CHECK (
    public.can_modify_student(student_id) AND parent_user_id = auth.uid()
);

CREATE POLICY "Parents can update family priority decisions"
ON public.student_priority_decisions
FOR UPDATE
USING (
    public.can_modify_student(student_id)
)
WITH CHECK (
    public.can_modify_student(student_id) AND parent_user_id = auth.uid()
);

CREATE POLICY "Parents can delete family priority decisions"
ON public.student_priority_decisions
FOR DELETE
USING (
    public.can_modify_student(student_id)
);

-- Decision History RLS: Read-only access for authorized family members
CREATE POLICY "Family members can read priority decision history"
ON public.student_priority_decision_history
FOR SELECT
USING (
    public.can_read_student(student_id)
);

-- Decision History RLS: Insert allowed for parents via controlled operations
CREATE POLICY "Parents can append priority decision history"
ON public.student_priority_decision_history
FOR INSERT
WITH CHECK (
    public.can_modify_student(student_id) AND parent_user_id = auth.uid()
);

-- No UPDATE or DELETE policy exists for student_priority_decision_history

-- -----------------------------------------------------------------------------
-- 5. ATOMIC RPC: record_parent_priority_decision
-- Server-authoritative transaction recording parent decisions and immutable history
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_parent_priority_decision(
    p_student_id UUID,
    p_student_subject_id UUID,
    p_learning_objective_id UUID,
    p_decision_type TEXT,
    p_parent_priority_order INTEGER DEFAULT NULL,
    p_parent_notes TEXT DEFAULT NULL,
    p_system_tier TEXT DEFAULT 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE',
    p_system_rank INTEGER DEFAULT 1,
    p_state_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_parent BOOLEAN;
    v_spec_id UUID;
    v_lo_spec_id UUID;
    v_existing_id UUID;
    v_prev_decision_type TEXT;
    v_prev_parent_order INTEGER;
    v_decision_record RECORD;
    v_history_id UUID;
BEGIN
    -- 1. Authenticate caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    -- 2. Validate caller authorization and PARENT role on student
    IF NOT public.can_modify_student(p_student_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not authorized to modify student %.', p_student_id;
    END IF;

    -- 3. Validate student_subject belongs to student and retrieve bound specification
    SELECT specification_id INTO v_spec_id
    FROM public.student_subjects
    WHERE id = p_student_subject_id AND student_id = p_student_id;

    IF v_spec_id IS NULL THEN
        RAISE EXCEPTION 'Domain error: Student subject % does not belong to student %.', p_student_subject_id, p_student_id;
    END IF;

    -- 4. Validate learning_objective belongs to student's bound specification
    SELECT t.specification_id INTO v_lo_spec_id
    FROM public.learning_objectives lo
    JOIN public.curriculum_concepts c ON c.id = lo.concept_id
    JOIN public.curriculum_topics t ON t.id = c.topic_id
    WHERE lo.id = p_learning_objective_id;

    IF v_lo_spec_id IS NULL OR v_lo_spec_id <> v_spec_id THEN
        RAISE EXCEPTION 'Specification consistency error: Learning objective % belongs to spec %, but subject is bound to spec %.',
            p_learning_objective_id, v_lo_spec_id, v_spec_id;
    END IF;

    -- 5. Validate decision_type
    IF p_decision_type NOT IN ('APPROVED', 'DEFERRED', 'OVERRIDDEN', 'EXCLUDED') THEN
        RAISE EXCEPTION 'Domain error: Invalid decision_type %.', p_decision_type;
    END IF;

    -- 6. Fetch existing decision if present
    SELECT id, decision_type, parent_priority_order
    INTO v_existing_id, v_prev_decision_type, v_prev_parent_order
    FROM public.student_priority_decisions
    WHERE student_id = p_student_id AND learning_objective_id = p_learning_objective_id;

    -- 7. Upsert Current Operational Decision Record
    IF v_existing_id IS NOT NULL THEN
        UPDATE public.student_priority_decisions
        SET
            decision_type = p_decision_type,
            parent_priority_order = p_parent_priority_order,
            parent_notes = p_parent_notes,
            parent_user_id = v_caller_id,
            system_tier_at_decision = p_system_tier,
            system_rank_at_decision = p_system_rank,
            review_status = 'CURRENT',
            state_hash_at_decision = p_state_hash,
            updated_at = NOW()
        WHERE id = v_existing_id
        RETURNING * INTO v_decision_record;
    ELSE
        INSERT INTO public.student_priority_decisions (
            student_id,
            student_subject_id,
            learning_objective_id,
            parent_user_id,
            decision_type,
            parent_priority_order,
            parent_notes,
            system_tier_at_decision,
            system_rank_at_decision,
            review_status,
            state_hash_at_decision,
            created_at,
            updated_at
        ) VALUES (
            p_student_id,
            p_student_subject_id,
            p_learning_objective_id,
            v_caller_id,
            p_decision_type,
            p_parent_priority_order,
            p_parent_notes,
            p_system_tier,
            p_system_rank,
            'CURRENT',
            p_state_hash,
            NOW(),
            NOW()
        )
        RETURNING * INTO v_decision_record;
    END IF;

    -- 8. Append Exactly One Immutable History Event
    INSERT INTO public.student_priority_decision_history (
        decision_id,
        student_id,
        student_subject_id,
        learning_objective_id,
        parent_user_id,
        previous_decision_type,
        new_decision_type,
        previous_parent_order,
        new_parent_order,
        system_tier_at_event,
        system_rank_at_event,
        reason,
        event_timestamp
    ) VALUES (
        v_decision_record.id,
        p_student_id,
        p_student_subject_id,
        p_learning_objective_id,
        v_caller_id,
        v_prev_decision_type,
        p_decision_type,
        v_prev_parent_order,
        p_parent_priority_order,
        p_system_tier,
        p_system_rank,
        p_parent_notes,
        NOW()
    )
    RETURNING id INTO v_history_id;

    -- 9. Return structured confirmation
    RETURN jsonb_build_object(
        'decision_id', v_decision_record.id,
        'history_id', v_history_id,
        'student_id', v_decision_record.student_id,
        'learning_objective_id', v_decision_record.learning_objective_id,
        'decision_type', v_decision_record.decision_type,
        'parent_priority_order', v_decision_record.parent_priority_order,
        'system_tier', v_decision_record.system_tier_at_decision,
        'system_rank', v_decision_record.system_rank_at_decision,
        'review_status', v_decision_record.review_status,
        'created_at', v_decision_record.created_at,
        'updated_at', v_decision_record.updated_at
    );
END;
$$;
