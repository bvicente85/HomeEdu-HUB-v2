-- =============================================================================
-- Migration: Phase 2C.2 Prerequisite Graph Traversal & Diagnostic RPC
-- Date: 2026-10-05
-- Targets:
--   - public.create_diagnostic_session_with_targets (Atomic RPC for session creation)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_diagnostic_session_with_targets(
    p_student_id UUID,
    p_student_subject_id UUID,
    p_specification_id UUID,
    p_title TEXT,
    p_purpose TEXT,
    p_targets JSONB -- array of objects: [{ learning_objective_id, concept_id, target_order, notes }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session_id UUID;
    v_target JSONB;
    v_count INT := 0;
    v_res JSONB;
BEGIN
    -- 1. Authorization: Only parents in the student's family can create diagnostic sessions
    IF NOT public.can_modify_student(p_student_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only parents can create diagnostic sessions for this student.';
    END IF;

    -- 2. Validate student subject context
    IF p_student_subject_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.student_subjects
            WHERE id = p_student_subject_id AND student_id = p_student_id
        ) THEN
            RAISE EXCEPTION 'Domain error: student_subject_id does not belong to student %', p_student_id;
        END IF;
    END IF;

    -- 3. Validate specification
    IF p_specification_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.specifications WHERE id = p_specification_id
        ) THEN
            RAISE EXCEPTION 'Domain error: specification_id % does not exist', p_specification_id;
        END IF;
    END IF;

    -- 4. Validate targets payload
    IF p_targets IS NULL OR jsonb_array_length(p_targets) = 0 THEN
        RAISE EXCEPTION 'Validation error: At least one diagnostic target is required.';
    END IF;

    -- 5. Insert Diagnostic Session (Status strictly PLANNED)
    INSERT INTO public.diagnostic_sessions (
        student_id,
        student_subject_id,
        specification_id,
        title,
        purpose,
        status,
        created_at,
        updated_at
    ) VALUES (
        p_student_id,
        p_student_subject_id,
        p_specification_id,
        p_title,
        p_purpose,
        'PLANNED',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_session_id;

    -- 6. Insert Diagnostic Targets in specified deterministic order
    FOR v_target IN SELECT * FROM jsonb_array_elements(p_targets)
    LOOP
        INSERT INTO public.diagnostic_targets (
            session_id,
            learning_objective_id,
            concept_id,
            target_order,
            status,
            notes,
            created_at
        ) VALUES (
            v_session_id,
            (v_target->>'learning_objective_id')::UUID,
            (v_target->>'concept_id')::UUID,
            COALESCE((v_target->>'target_order')::INT, v_count),
            'PENDING',
            v_target->>'notes',
            NOW()
        );
        v_count := v_count + 1;
    END LOOP;

    -- 7. Return complete session details
    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'student_id', p_student_id,
        'title', p_title,
        'status', 'PLANNED',
        'target_count', v_count
    ) INTO v_res;

    RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_diagnostic_session_with_targets TO authenticated;
