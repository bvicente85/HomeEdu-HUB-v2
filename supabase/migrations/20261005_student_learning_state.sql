-- =============================================================================
-- Migration: Phase 2B Student Learning State & Diagnostic Baseline Architecture
-- Date: 2026-10-05
-- Targets:
--   - public.student_learning_states
--   - public.diagnostic_sessions
--   - public.diagnostic_targets
--   - public.learning_evidence
--   - public.assessment_attempts
--   - public.learning_state_history
--
-- Security:
--   - Strict Family Isolation RLS
--   - Parents can inspect and manage student learning states for their family
--   - Students can only view their own learning state records
--   - No public access; zero cross-family leakage
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HELPER SECURITY FUNCTIONS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_read_student(s_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = s_id
          AND (
            public.is_member_of_family(s.family_id)
            OR s.profile_id = auth.uid()
          )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_read_student(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_modify_student(s_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = s_id
          AND public.is_parent_in_family(s.family_id)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_modify_student(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. STUDENT LEARNING STATES TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_learning_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    mastery_state VARCHAR(32) NOT NULL DEFAULT 'NOT_ASSESSED'
        CHECK (mastery_state IN ('NOT_ASSESSED', 'EMERGING', 'DEVELOPING', 'SECURE', 'MASTERED')),
    gap_status VARCHAR(32) NOT NULL DEFAULT 'NO_DATA'
        CHECK (gap_status IN ('NO_DATA', 'ON_TRACK', 'DEVELOPING', 'GAP', 'PREREQUISITE_GAP')),
    evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
    last_assessed_at TIMESTAMPTZ,
    last_demonstrated_at TIMESTAMPTZ,
    confidence_level VARCHAR(16) NOT NULL DEFAULT 'LOW'
        CHECK (confidence_level IN ('LOW', 'MEDIUM', 'HIGH')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_student_learning_state UNIQUE (student_id, learning_objective_id)
);

CREATE INDEX IF NOT EXISTS idx_sls_student_lo ON public.student_learning_states(student_id, learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_sls_student_mastery ON public.student_learning_states(student_id, mastery_state);
CREATE INDEX IF NOT EXISTS idx_sls_student_gap ON public.student_learning_states(student_id, gap_status);

DROP TRIGGER IF EXISTS trg_update_student_learning_states_timestamp ON public.student_learning_states;
CREATE TRIGGER trg_update_student_learning_states_timestamp
    BEFORE UPDATE ON public.student_learning_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. DIAGNOSTIC ASSESSMENT SESSIONS TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_subject_id UUID REFERENCES public.student_subjects(id) ON DELETE SET NULL,
    specification_id UUID REFERENCES public.curriculum_specifications(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
        CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    purpose TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diag_sess_student ON public.diagnostic_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_diag_sess_spec ON public.diagnostic_sessions(specification_id);

DROP TRIGGER IF EXISTS trg_update_diagnostic_sessions_timestamp ON public.diagnostic_sessions;
CREATE TRIGGER trg_update_diagnostic_sessions_timestamp
    BEFORE UPDATE ON public.diagnostic_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. DIAGNOSTIC TARGETS TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.diagnostic_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
    learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES public.curriculum_concepts(id) ON DELETE CASCADE,
    target_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ASSESSED', 'SKIPPED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diag_targets_session ON public.diagnostic_targets(session_id, target_order);
CREATE INDEX IF NOT EXISTS idx_diag_targets_lo ON public.diagnostic_targets(learning_objective_id);

-- -----------------------------------------------------------------------------
-- 5. LEARNING EVIDENCE TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.learning_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    evidence_type VARCHAR(64) NOT NULL
        CHECK (evidence_type IN ('DIAGNOSTIC_ASSESSMENT', 'LEARNING_ACTIVITY', 'EXERCISE', 'WRITTEN_WORK', 'PARENT_OBSERVATION', 'TUTOR_ASSESSMENT', 'PARENT_OVERRIDE')),
    support_level VARCHAR(32) NOT NULL DEFAULT 'INDEPENDENT'
        CHECK (support_level IN ('INDEPENDENT', 'MINOR_SUPPORT', 'SIGNIFICANT_SUPPORT')),
    result_status VARCHAR(32) NOT NULL
        CHECK (result_status IN ('DEMONSTRATED', 'PARTIALLY_DEMONSTRATED', 'NOT_DEMONSTRATED')),
    reliability VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
        CHECK (reliability IN ('LOW', 'MEDIUM', 'HIGH')),
    source_reference TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_student_lo ON public.learning_evidence(student_id, learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_evidence_captured ON public.learning_evidence(student_id, captured_at DESC);

-- -----------------------------------------------------------------------------
-- 6. ASSESSMENT ATTEMPTS TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    diagnostic_session_id UUID REFERENCES public.diagnostic_sessions(id) ON DELETE SET NULL,
    assessment_item_id UUID REFERENCES public.assessment_items(id) ON DELETE SET NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result VARCHAR(32) NOT NULL
        CHECK (result IN ('CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT')),
    raw_score NUMERIC(5,2),
    max_score NUMERIC(5,2),
    support_level VARCHAR(32) NOT NULL DEFAULT 'INDEPENDENT'
        CHECK (support_level IN ('INDEPENDENT', 'MINOR_SUPPORT', 'SIGNIFICANT_SUPPORT')),
    evidence_id UUID REFERENCES public.learning_evidence(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_student_lo ON public.assessment_attempts(student_id, learning_objective_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON public.assessment_attempts(diagnostic_session_id);

-- -----------------------------------------------------------------------------
-- 7. LEARNING STATE HISTORY TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.learning_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_state_id UUID NOT NULL REFERENCES public.student_learning_states(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    previous_mastery_state VARCHAR(32)
        CHECK (previous_mastery_state IS NULL OR previous_mastery_state IN ('NOT_ASSESSED', 'EMERGING', 'DEVELOPING', 'SECURE', 'MASTERED')),
    new_mastery_state VARCHAR(32) NOT NULL
        CHECK (new_mastery_state IN ('NOT_ASSESSED', 'EMERGING', 'DEVELOPING', 'SECURE', 'MASTERED')),
    previous_gap_status VARCHAR(32)
        CHECK (previous_gap_status IS NULL OR previous_gap_status IN ('NO_DATA', 'ON_TRACK', 'DEVELOPING', 'GAP', 'PREREQUISITE_GAP')),
    new_gap_status VARCHAR(32) NOT NULL
        CHECK (new_gap_status IN ('NO_DATA', 'ON_TRACK', 'DEVELOPING', 'GAP', 'PREREQUISITE_GAP')),
    change_reason VARCHAR(64) NOT NULL
        CHECK (change_reason IN ('INITIAL_STATE', 'ASSESSMENT_EVALUATION', 'EVIDENCE_RECORDED', 'PARENT_OVERRIDE', 'PREREQUISITE_ANALYSIS', 'MANUAL_ADJUSTMENT')),
    evidence_id UUID REFERENCES public.learning_evidence(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_state ON public.learning_state_history(learning_state_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_student ON public.learning_state_history(student_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.student_learning_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_state_history ENABLE ROW LEVEL SECURITY;

-- student_learning_states policies
DROP POLICY IF EXISTS "Family members can view student learning states" ON public.student_learning_states;
CREATE POLICY "Family members can view student learning states"
ON public.student_learning_states FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

DROP POLICY IF EXISTS "Parents can insert student learning states" ON public.student_learning_states;
CREATE POLICY "Parents can insert student learning states"
ON public.student_learning_states FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));

DROP POLICY IF EXISTS "Parents can update student learning states" ON public.student_learning_states;
CREATE POLICY "Parents can update student learning states"
ON public.student_learning_states FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

DROP POLICY IF EXISTS "Parents can delete student learning states" ON public.student_learning_states;
CREATE POLICY "Parents can delete student learning states"
ON public.student_learning_states FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

-- diagnostic_sessions policies
DROP POLICY IF EXISTS "Family members can view diagnostic sessions" ON public.diagnostic_sessions;
CREATE POLICY "Family members can view diagnostic sessions"
ON public.diagnostic_sessions FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

DROP POLICY IF EXISTS "Parents can insert diagnostic sessions" ON public.diagnostic_sessions;
CREATE POLICY "Parents can insert diagnostic sessions"
ON public.diagnostic_sessions FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));

DROP POLICY IF EXISTS "Parents can update diagnostic sessions" ON public.diagnostic_sessions;
CREATE POLICY "Parents can update diagnostic sessions"
ON public.diagnostic_sessions FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

DROP POLICY IF EXISTS "Parents can delete diagnostic sessions" ON public.diagnostic_sessions;
CREATE POLICY "Parents can delete diagnostic sessions"
ON public.diagnostic_sessions FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

-- diagnostic_targets policies
DROP POLICY IF EXISTS "Family members can view diagnostic targets" ON public.diagnostic_targets;
CREATE POLICY "Family members can view diagnostic targets"
ON public.diagnostic_targets FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.diagnostic_sessions ds
        WHERE ds.id = session_id AND public.can_read_student(ds.student_id)
    )
);

DROP POLICY IF EXISTS "Parents can manage diagnostic targets" ON public.diagnostic_targets;
CREATE POLICY "Parents can manage diagnostic targets"
ON public.diagnostic_targets FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.diagnostic_sessions ds
        WHERE ds.id = session_id AND public.can_modify_student(ds.student_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.diagnostic_sessions ds
        WHERE ds.id = session_id AND public.can_modify_student(ds.student_id)
    )
);

-- learning_evidence policies
DROP POLICY IF EXISTS "Family members can view learning evidence" ON public.learning_evidence;
CREATE POLICY "Family members can view learning evidence"
ON public.learning_evidence FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

DROP POLICY IF EXISTS "Parents can insert learning evidence" ON public.learning_evidence;
CREATE POLICY "Parents can insert learning evidence"
ON public.learning_evidence FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));

DROP POLICY IF EXISTS "Parents can update learning evidence" ON public.learning_evidence;
CREATE POLICY "Parents can update learning evidence"
ON public.learning_evidence FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

DROP POLICY IF EXISTS "Parents can delete learning evidence" ON public.learning_evidence;
CREATE POLICY "Parents can delete learning evidence"
ON public.learning_evidence FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

-- assessment_attempts policies
DROP POLICY IF EXISTS "Family members can view assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Family members can view assessment attempts"
ON public.assessment_attempts FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

DROP POLICY IF EXISTS "Authorized members can insert assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Authorized members can insert assessment attempts"
ON public.assessment_attempts FOR INSERT
TO authenticated
WITH CHECK (
    public.can_modify_student(student_id)
    OR (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_id AND s.profile_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Parents can update assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Parents can update assessment attempts"
ON public.assessment_attempts FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

DROP POLICY IF EXISTS "Parents can delete assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Parents can delete assessment attempts"
ON public.assessment_attempts FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

-- learning_state_history policies
DROP POLICY IF EXISTS "Family members can view learning state history" ON public.learning_state_history;
CREATE POLICY "Family members can view learning state history"
ON public.learning_state_history FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

DROP POLICY IF EXISTS "Parents can insert learning state history" ON public.learning_state_history;
CREATE POLICY "Parents can insert learning state history"
ON public.learning_state_history FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));
