-- =============================================================================
-- Migration: Phase 2C.3 Diagnostic Runner & Authoritative Evaluation RPC
-- Date: 2026-10-05
-- Targets:
--   - public.submit_diagnostic_response (Server-authoritative evaluation & learning state transaction)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_diagnostic_response(
    p_student_id UUID,
    p_session_id UUID,
    p_target_id UUID,
    p_assessment_item_id UUID,
    p_submitted_response TEXT,
    p_support_level VARCHAR(32) DEFAULT 'INDEPENDENT'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_target RECORD;
    v_item RECORD;
    v_content RECORD;
    v_student RECORD;
    v_eval_result VARCHAR(32);
    v_raw_score NUMERIC(5,2) := 0;
    v_max_score NUMERIC(5,2);
    v_now TIMESTAMPTZ := NOW();
    v_evidence_id UUID;
    v_attempt_id UUID;
    v_state_id UUID;
    v_history_id UUID;
    v_prev_state RECORD;
    v_prev_mastery VARCHAR(32);
    v_prev_gap VARCHAR(32);
    v_prev_evidence_count INT := 0;
    v_new_mastery VARCHAR(32);
    v_new_gap VARCHAR(32);
    v_new_demonstrated TIMESTAMPTZ;
    v_pending_targets_count INT;
    v_session_completed BOOLEAN := false;
    v_trimmed_response TEXT;
    v_trimmed_canonical TEXT;
    v_numeric_sub NUMERIC;
    v_numeric_can NUMERIC;
    v_tolerance NUMERIC;
    v_eq_matched BOOLEAN := false;
    v_eq_rep TEXT;
BEGIN
    -- 1. Authorization: Authenticated caller must have access to student record
    IF NOT public.can_read_student(p_student_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot access student %', p_student_id;
    END IF;

    -- 2. Validate Student exists
    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Domain error: Student % does not exist', p_student_id;
    END IF;

    -- 3. Validate Session exists and belongs to student
    SELECT * INTO v_session FROM public.diagnostic_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Domain error: Diagnostic session % does not exist', p_session_id;
    END IF;

    IF v_session.student_id <> p_student_id THEN
        RAISE EXCEPTION 'Domain error: Diagnostic session % belongs to student %, not %', p_session_id, v_session.student_id, p_student_id;
    END IF;

    IF v_session.status = 'COMPLETED' OR v_session.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'State error: Cannot submit response to a % diagnostic session', v_session.status;
    END IF;

    -- 4. Validate Target exists, belongs to session
    SELECT * INTO v_target FROM public.diagnostic_targets WHERE id = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Domain error: Diagnostic target % does not exist', p_target_id;
    END IF;

    IF v_target.session_id <> p_session_id THEN
        RAISE EXCEPTION 'Domain error: Diagnostic target % does not belong to session %', p_target_id, p_session_id;
    END IF;

    -- 5. Validate Assessment Item
    SELECT * INTO v_item FROM public.assessment_items WHERE id = p_assessment_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Domain error: Assessment item % does not exist', p_assessment_item_id;
    END IF;

    -- Validate that assessment item matches target's learning objective
    IF v_item.learning_objective_id <> v_target.learning_objective_id THEN
        RAISE EXCEPTION 'Domain error: Assessment item % objective % does not match target objective %',
            p_assessment_item_id, v_item.learning_objective_id, v_target.learning_objective_id;
    END IF;

    -- Validate specification consistency (item spec == session spec)
    IF v_session.specification_id IS NOT NULL AND v_item.specification_id <> v_session.specification_id THEN
        RAISE EXCEPTION 'Specification consistency error: Assessment item spec % does not match session spec %',
            v_item.specification_id, v_session.specification_id;
    END IF;

    -- 6. Check for duplicate submission on this target
    SELECT id INTO v_attempt_id FROM public.assessment_attempts
    WHERE diagnostic_session_id = p_session_id AND assessment_item_id = p_assessment_item_id
    LIMIT 1;

    IF v_attempt_id IS NOT NULL THEN
        RAISE EXCEPTION 'Duplicate submission error: An authoritative attempt already exists for session % and item %',
            p_session_id, p_assessment_item_id;
    END IF;

    -- 7. Load Active Assessment Item Content for deterministic evaluation
    SELECT * INTO v_content FROM public.assessment_item_content
    WHERE assessment_item_id = p_assessment_item_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Content error: No deliverable content found for assessment item %', p_assessment_item_id;
    END IF;

    v_max_score := COALESCE(v_item.total_marks, 1);
    v_trimmed_response := TRIM(p_submitted_response);
    v_trimmed_canonical := TRIM(v_content.canonical_answer);

    -- 8. Deterministic Evaluation
    IF v_content.content_format = 'MULTIPLE_CHOICE' THEN
        IF UPPER(v_trimmed_response) = UPPER(v_trimmed_canonical) THEN
            v_eval_result := 'CORRECT';
            v_raw_score := v_max_score;
        ELSE
            v_eval_result := 'INCORRECT';
            v_raw_score := 0;
        END IF;

    ELSIF v_content.content_format = 'SHORT_NUMERIC' THEN
        BEGIN
            v_numeric_sub := v_trimmed_response::NUMERIC;
            v_numeric_can := v_trimmed_canonical::NUMERIC;
            v_tolerance := COALESCE(v_content.answer_tolerance, 0);

            IF ABS(v_numeric_sub - v_numeric_can) <= v_tolerance THEN
                v_eval_result := 'CORRECT';
                v_raw_score := v_max_score;
            ELSE
                v_eval_result := 'INCORRECT';
                v_raw_score := 0;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_eval_result := 'INVALID_RESPONSE';
            v_raw_score := 0;
        END;

    ELSIF v_content.content_format = 'EXACT_EXPRESSION' THEN
        IF LOWER(REGEXP_REPLACE(v_trimmed_response, '\s+', '', 'g')) = LOWER(REGEXP_REPLACE(v_trimmed_canonical, '\s+', '', 'g')) THEN
            v_eval_result := 'CORRECT';
            v_raw_score := v_max_score;
        ELSE
            v_eq_matched := false;
            IF v_content.equivalent_representations IS NOT NULL THEN
                FOREACH v_eq_rep IN ARRAY v_content.equivalent_representations
                LOOP
                    IF LOWER(REGEXP_REPLACE(v_trimmed_response, '\s+', '', 'g')) = LOWER(REGEXP_REPLACE(TRIM(v_eq_rep), '\s+', '', 'g')) THEN
                        v_eq_matched := true;
                        EXIT;
                    END IF;
                END LOOP;
            END IF;

            IF v_eq_matched THEN
                v_eval_result := 'CORRECT';
                v_raw_score := v_max_score;
            ELSE
                v_eval_result := 'INCORRECT';
                v_raw_score := 0;
            END IF;
        END IF;
    ELSE
        v_eval_result := 'UNSUPPORTED';
        v_raw_score := 0;
    END IF;

    -- 9. If session was PLANNED, transition to IN_PROGRESS
    IF v_session.status = 'PLANNED' THEN
        UPDATE public.diagnostic_sessions
        SET status = 'IN_PROGRESS', started_at = COALESCE(started_at, v_now), updated_at = v_now
        WHERE id = p_session_id;
    END IF;

    -- 10. If valid evaluation (CORRECT or INCORRECT), create Learning Evidence
    IF v_eval_result IN ('CORRECT', 'INCORRECT') THEN
        v_evidence_id := gen_random_uuid();
        INSERT INTO public.learning_evidence (
            id,
            student_id,
            learning_objective_id,
            evidence_type,
            support_level,
            result_status,
            reliability,
            source_reference,
            captured_at,
            notes,
            created_at
        ) VALUES (
            v_evidence_id,
            p_student_id,
            v_target.learning_objective_id,
            'DIAGNOSTIC_ASSESSMENT',
            p_support_level,
            CASE WHEN v_eval_result = 'CORRECT' THEN 'DEMONSTRATED' ELSE 'NOT_DEMONSTRATED' END,
            'HIGH',
            'Diagnostic Session: ' || v_session.title || ' (Item: ' || v_item.item_reference || ')',
            v_now,
            'Authoritative response evaluation: ' || v_eval_result || ' (' || v_raw_score || '/' || v_max_score || ' marks)',
            v_now
        );

        -- 11. Learning State Transition & History
        SELECT * INTO v_prev_state FROM public.student_learning_states
        WHERE student_id = p_student_id AND learning_objective_id = v_target.learning_objective_id;

        IF FOUND THEN
            v_state_id := v_prev_state.id;
            v_prev_mastery := v_prev_state.mastery_state;
            v_prev_gap := v_prev_state.gap_status;
            v_prev_evidence_count := v_prev_state.evidence_count;
            v_new_demonstrated := CASE WHEN v_eval_result = 'CORRECT' THEN v_now ELSE v_prev_state.last_demonstrated_at END;
        ELSE
            v_state_id := gen_random_uuid();
            v_prev_mastery := NULL;
            v_prev_gap := NULL;
            v_prev_evidence_count := 0;
            v_new_demonstrated := CASE WHEN v_eval_result = 'CORRECT' THEN v_now ELSE NULL END;
        END IF;

        -- Conservative transition rule for first vertical slice:
        -- CORRECT -> SECURE (ON_TRACK)
        -- INCORRECT -> DEVELOPING (GAP)
        IF v_eval_result = 'CORRECT' THEN
            v_new_mastery := 'SECURE';
            v_new_gap := 'ON_TRACK';
        ELSE
            v_new_mastery := 'DEVELOPING';
            v_new_gap := 'GAP';
        END IF;

        INSERT INTO public.student_learning_states (
            id,
            student_id,
            learning_objective_id,
            mastery_state,
            gap_status,
            evidence_count,
            last_assessed_at,
            last_demonstrated_at,
            confidence_level,
            notes,
            created_at,
            updated_at
        ) VALUES (
            v_state_id,
            p_student_id,
            v_target.learning_objective_id,
            v_new_mastery,
            v_new_gap,
            v_prev_evidence_count + 1,
            v_now,
            v_new_demonstrated,
            'HIGH',
            'Updated via Diagnostic Session ' || v_session.title,
            v_now,
            v_now
        )
        ON CONFLICT (student_id, learning_objective_id) DO UPDATE SET
            mastery_state = EXCLUDED.mastery_state,
            gap_status = EXCLUDED.gap_status,
            evidence_count = public.student_learning_states.evidence_count + 1,
            last_assessed_at = EXCLUDED.last_assessed_at,
            last_demonstrated_at = COALESCE(EXCLUDED.last_demonstrated_at, public.student_learning_states.last_demonstrated_at),
            confidence_level = EXCLUDED.confidence_level,
            notes = EXCLUDED.notes,
            updated_at = v_now;

        -- 12. Append immutable Learning State History
        v_history_id := gen_random_uuid();
        INSERT INTO public.learning_state_history (
            id,
            learning_state_id,
            student_id,
            learning_objective_id,
            previous_mastery_state,
            new_mastery_state,
            previous_gap_status,
            new_gap_status,
            change_reason,
            evidence_id,
            notes,
            created_at
        ) VALUES (
            v_history_id,
            v_state_id,
            p_student_id,
            v_target.learning_objective_id,
            v_prev_mastery,
            v_new_mastery,
            v_prev_gap,
            v_new_gap,
            'ASSESSMENT_EVALUATION',
            v_evidence_id,
            'Diagnostic attempt result: ' || v_eval_result || ' on item ' || v_item.item_reference,
            v_now
        );
    END IF;

    -- 13. Persist Assessment Attempt
    v_attempt_id := gen_random_uuid();
    INSERT INTO public.assessment_attempts (
        id,
        student_id,
        learning_objective_id,
        diagnostic_session_id,
        assessment_item_id,
        attempted_at,
        result,
        raw_score,
        max_score,
        support_level,
        evidence_id,
        notes,
        created_at
    ) VALUES (
        v_attempt_id,
        p_student_id,
        v_target.learning_objective_id,
        p_session_id,
        p_assessment_item_id,
        v_now,
        CASE WHEN v_eval_result = 'CORRECT' THEN 'CORRECT' ELSE 'INCORRECT' END,
        v_raw_score,
        v_max_score,
        p_support_level,
        v_evidence_id,
        'Submitted: ' || v_trimmed_response || ' | Evaluation: ' || v_eval_result,
        v_now
    );

    -- 14. Mark Target as ASSESSED
    UPDATE public.diagnostic_targets
    SET status = 'ASSESSED', notes = 'Attempt ' || v_attempt_id || ': ' || v_eval_result
    WHERE id = p_target_id;

    -- 15. Check if all targets in the session are now ASSESSED
    SELECT COUNT(*) INTO v_pending_targets_count
    FROM public.diagnostic_targets
    WHERE session_id = p_session_id AND status = 'PENDING';

    IF v_pending_targets_count = 0 THEN
        UPDATE public.diagnostic_sessions
        SET status = 'COMPLETED', completed_at = v_now, updated_at = v_now
        WHERE id = p_session_id;
        v_session_completed := true;
    END IF;

    -- 16. Return authoritative audit summary
    RETURN jsonb_build_object(
        'attempt_id', v_attempt_id,
        'evidence_id', v_evidence_id,
        'evaluation_result', v_eval_result,
        'raw_score', v_raw_score,
        'max_score', v_max_score,
        'is_correct', (v_eval_result = 'CORRECT'),
        'previous_mastery', v_prev_mastery,
        'new_mastery', v_new_mastery,
        'previous_gap', v_prev_gap,
        'new_gap', v_new_gap,
        'session_completed', v_session_completed,
        'pending_targets_remaining', v_pending_targets_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_diagnostic_response TO authenticated;
