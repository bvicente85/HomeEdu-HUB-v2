-- =============================================================================
-- Migration: Phase 2C.1 Assessment Content Schema, Student Spec Binding & Item Bank
-- Date: 2026-10-05
-- Targets:
--   - public.student_subjects (Add specification_id foreign key)
--   - public.assessment_item_content (New table for deliverable question content)
--   - Seed data for 12 original diagnostic items for Edexcel 1MA1 vertical slice
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. STUDENT SUBJECTS SPECIFICATION BINDING
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'student_subjects' 
          AND column_name = 'specification_id'
    ) THEN
        ALTER TABLE public.student_subjects
        ADD COLUMN specification_id UUID REFERENCES public.specifications(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_subjects_specification 
ON public.student_subjects(specification_id);

-- Deterministically bind any existing Mathematics student subjects to the Edexcel 1MA1 slice
UPDATE public.student_subjects
SET specification_id = '00000007-0000-0000-0000-000000000001'
WHERE subject_name = 'Mathematics'
  AND (specification_code = '1MA1' OR exam_board = 'Edexcel / Pearson')
  AND specification_id IS NULL;

-- -----------------------------------------------------------------------------
-- 2. ASSESSMENT ITEM CONTENT TABLE
-- Stores deliverable content separate from curriculum metadata
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assessment_item_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_item_id UUID NOT NULL REFERENCES public.assessment_items(id) ON DELETE CASCADE,
    version TEXT NOT NULL DEFAULT 'v1',
    content_format TEXT NOT NULL CHECK (
        content_format IN ('MULTIPLE_CHOICE', 'SHORT_NUMERIC', 'EXACT_EXPRESSION')
    ),
    prompt TEXT NOT NULL,
    options JSONB,
    canonical_answer TEXT NOT NULL,
    answer_tolerance NUMERIC(8,4),
    answer_unit TEXT,
    equivalent_representations TEXT[],
    source_type TEXT NOT NULL CHECK (
        source_type IN ('ORIGINAL_HOMEEDU', 'OFFICIAL_SOURCE', 'OPEN_LICENSED', 'DERIVED_ADAPTATION')
    ) DEFAULT 'ORIGINAL_HOMEEDU',
    verification_status TEXT NOT NULL CHECK (
        verification_status IN ('VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED')
    ) DEFAULT 'VERIFIED_OFFICIAL',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_item_content_version UNIQUE (assessment_item_id, version)
);

CREATE INDEX IF NOT EXISTS idx_item_content_item ON public.assessment_item_content(assessment_item_id);

-- RLS: Assessment content is global curriculum data
ALTER TABLE public.assessment_item_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read assessment_item_content" ON public.assessment_item_content;
CREATE POLICY "Public read assessment_item_content"
ON public.assessment_item_content FOR SELECT
USING (true);

-- -----------------------------------------------------------------------------
-- 3. SEED 12 ORIGINAL DIAGNOSTIC ITEMS (2 PER OBJECTIVE) FOR EDEXCEL 1MA1 SLICE
-- -----------------------------------------------------------------------------

-- Objective 1: Linear Equations (LO-EDX-ALG-LIN-01)
-- Item 1: DIAG-EDX-MATH-LIN-01
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000101',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000001',
    '00000011-0000-0000-0000-000000000001',
    '00000008-0000-0000-0000-000000000001',
    'DIAG-EDX-MATH-LIN-01',
    'Foundation',
    false,
    2,
    'SHORT_PROCEDURAL',
    'Grade 2-3',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Two-step single variable linear equation test.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000101',
    '00000013-0000-0000-0000-000000000101',
    'v1',
    'SHORT_NUMERIC',
    'Solve the linear equation for $x$:\n$$4x + 7 = 31$$',
    null,
    '6',
    0,
    null,
    ARRAY['6', 'x=6', 'x = 6'],
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Canonical answer is 6.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Item 2: DIAG-EDX-MATH-LIN-02
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000102',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000001',
    '00000011-0000-0000-0000-000000000001',
    '00000008-0000-0000-0000-000000000001',
    'DIAG-EDX-MATH-LIN-02',
    'Higher',
    false,
    3,
    'SHORT_PROCEDURAL',
    'Grade 4-5',
    true,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Linear equation with unknowns on both sides.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000102',
    '00000013-0000-0000-0000-000000000102',
    'v1',
    'MULTIPLE_CHOICE',
    'Solve the linear equation with unknowns on both sides:\n$$5x - 3 = 2x + 12$$',
    '[
        {"id": "A", "text": "x = 5", "distractor_rationale": "Correct: 5x - 2x = 12 + 3 => 3x = 15 => x = 5"},
        {"id": "B", "text": "x = 3", "distractor_rationale": "Subtracted 3 from 12 instead of adding (3x = 9)"},
        {"id": "C", "text": "x = 15/7", "distractor_rationale": "Added 2x to 5x instead of subtracting (7x = 15)"},
        {"id": "D", "text": "x = 1.5", "distractor_rationale": "Sign error on both constant and variable terms"}
    ]'::jsonb,
    'A',
    null,
    null,
    null,
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Multiple-choice diagnostic targeting linear transposition misconceptions.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Objective 2: Quadratic Equations (LO-EDX-ALG-QUAD-01)
-- Item 3: DIAG-EDX-MATH-QUAD-01
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000103',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000002',
    '00000011-0000-0000-0000-000000000002',
    '00000008-0000-0000-0000-000000000001',
    'DIAG-EDX-MATH-QUAD-01',
    'Common',
    false,
    3,
    'STRUCTURED_MULTI_STEP',
    'Grade 4-5',
    true,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Quadratic factorisation monic polynomial.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000103',
    '00000013-0000-0000-0000-000000000103',
    'v1',
    'MULTIPLE_CHOICE',
    'Solve the quadratic equation by factorisation:\n$$x^2 - 7x + 12 = 0$$',
    '[
        {"id": "A", "text": "x = 3 or x = 4", "distractor_rationale": "Correct: (x-3)(x-4) = 0 => x = 3, 4"},
        {"id": "B", "text": "x = -3 or x = -4", "distractor_rationale": "Factor sign inversion: forgot to solve factor = 0"},
        {"id": "C", "text": "x = 2 or x = 6", "distractor_rationale": "Factors of 12 summing to 8 rather than 7"},
        {"id": "D", "text": "x = -1 or x = 12", "distractor_rationale": "Incorrect factor pairs"}
    ]'::jsonb,
    'A',
    null,
    null,
    null,
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Tests root identification vs factor expression.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Item 4: DIAG-EDX-MATH-QUAD-02
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000104',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000002',
    '00000011-0000-0000-0000-000000000002',
    '00000008-0000-0000-0000-000000000001',
    'DIAG-EDX-MATH-QUAD-02',
    'Higher',
    false,
    3,
    'STRUCTURED_MULTI_STEP',
    'Grade 6-7',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Non-monic quadratic factorisation.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000104',
    '00000013-0000-0000-0000-000000000104',
    'v1',
    'MULTIPLE_CHOICE',
    'Solve the quadratic equation where $a > 1$:\n$$2x^2 + 5x - 3 = 0$$',
    '[
        {"id": "A", "text": "x = 1/2 or x = -3", "distractor_rationale": "Correct: (2x - 1)(x + 3) = 0 => x = 1/2, -3"},
        {"id": "B", "text": "x = -1/2 or x = 3", "distractor_rationale": "Root sign flip error"},
        {"id": "C", "text": "x = 1 or x = -3/2", "distractor_rationale": "Incorrect factor split (2x + 3)(x - 1)"},
        {"id": "D", "text": "x = 3/2 or x = -1", "distractor_rationale": "Incorrect constant distribution"}
    ]'::jsonb,
    'A',
    null,
    null,
    null,
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Tests non-monic factoring.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Objective 3: Vector Arithmetic (LO-EDX-GEO-VEC-01)
-- Item 5: DIAG-EDX-MATH-VEC-01
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000105',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000004',
    '00000010-0000-0000-0000-000000000003',
    '00000011-0000-0000-0000-000000000003',
    '00000008-0000-0000-0000-000000000002',
    'DIAG-EDX-MATH-VEC-01',
    'Higher',
    false,
    3,
    'EXTENDED_REASONING',
    'Grade 7-8',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Vector collinearity and scalar multiples.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000105',
    '00000013-0000-0000-0000-000000000105',
    'v1',
    'MULTIPLE_CHOICE',
    'Vector $\\mathbf{p} = 2\\mathbf{a} + 3\\mathbf{b}$ and vector $\\mathbf{q} = 6\\mathbf{a} + 9\\mathbf{b}$. Which statement correctly describes the geometric relationship between vectors $\\mathbf{p}$ and $\\mathbf{q}$?',
    '[
        {"id": "A", "text": "q is parallel to p because q = 3p (scalar multiple)", "distractor_rationale": "Correct: q is 3 times p, proving parallel direction"},
        {"id": "B", "text": "q is perpendicular to p because their coefficients are in ratio 2:3", "distractor_rationale": "Confuses scalar multiple with perpendicularity"},
        {"id": "C", "text": "q and p have the same magnitude because they share a and b", "distractor_rationale": "Ignores the scalar factor 3 scaling magnitude"},
        {"id": "D", "text": "p and q are non-collinear basis vectors", "distractor_rationale": "Fails to recognise linear dependency"}
    ]'::jsonb,
    'A',
    null,
    null,
    null,
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Collinearity and parallel vector test.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Item 6: DIAG-EDX-MATH-VEC-02
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000106',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000004',
    '00000010-0000-0000-0000-000000000003',
    '00000011-0000-0000-0000-000000000003',
    '00000008-0000-0000-0000-000000000002',
    'DIAG-EDX-MATH-VEC-02',
    'Higher',
    false,
    2,
    'SHORT_PROCEDURAL',
    'Grade 7-8',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Vector subtraction on a line segment.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000106',
    '00000013-0000-0000-0000-000000000106',
    'v1',
    'EXACT_EXPRESSION',
    'If $\\vec{OA} = \\mathbf{a}$ and $\\vec{OB} = \\mathbf{b}$, express vector $\\vec{AB}$ in terms of $\\mathbf{a}$ and $\\mathbf{b}$.',
    null,
    'b - a',
    null,
    null,
    ARRAY['b - a', '-a + b', 'b-a', '-a+b'],
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Canonical expression is b - a.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Objective 4: Circle Theorems (LO-EDX-GEO-CIRC-01)
-- Item 7: DIAG-EDX-MATH-CIRC-01
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000107',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000004',
    '00000010-0000-0000-0000-000000000004',
    '00000011-0000-0000-0000-000000000004',
    '00000008-0000-0000-0000-000000000002',
    'DIAG-EDX-MATH-CIRC-01',
    'Higher',
    false,
    2,
    'SHORT_PROCEDURAL',
    'Grade 7-8',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Angle at centre is twice angle at circumference theorem.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000107',
    '00000013-0000-0000-0000-000000000107',
    'v1',
    'SHORT_NUMERIC',
    'Points $A$, $B$, and $C$ lie on the circumference of a circle with centre $O$. Angle $\\angle AOC = 110^\\circ$. What is the size, in degrees, of angle $\\angle ABC$ subtended at the circumference by the same arc?',
    null,
    '55',
    0,
    'degrees',
    ARRAY['55', '55 deg', '55°'],
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Angle at centre is twice angle at circumference => 110 / 2 = 55.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Item 8: DIAG-EDX-MATH-CIRC-02
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000108',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000004',
    '00000010-0000-0000-0000-000000000004',
    '00000011-0000-0000-0000-000000000004',
    '00000008-0000-0000-0000-000000000002',
    'DIAG-EDX-MATH-CIRC-02',
    'Higher',
    false,
    2,
    'EXTENDED_REASONING',
    'Grade 7-8',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Cyclic quadrilateral angle sum theorem.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000108',
    '00000013-0000-0000-0000-000000000108',
    'v1',
    'MULTIPLE_CHOICE',
    'A cyclic quadrilateral $ABCD$ is inscribed in a circle. Angle $\\angle DAB = 72^\\circ$. What is the size of the opposite angle $\\angle BCD$, and which circle theorem justifies it?',
    '[
        {"id": "A", "text": "108°, because opposite angles of a cyclic quadrilateral sum to 180°", "distractor_rationale": "Correct: 180 - 72 = 108"},
        {"id": "B", "text": "72°, because angles in the same segment are equal", "distractor_rationale": "Confuses cyclic quadrilateral with same segment angles"},
        {"id": "C", "text": "144°, because angle at centre is twice angle at circumference", "distractor_rationale": "Applies centre theorem to opposite quadrilateral vertex"},
        {"id": "D", "text": "288°, because angles in a circle sum to 360°", "distractor_rationale": "Subtracted from 360 instead of 180"}
    ]'::jsonb,
    'A',
    null,
    null,
    null,
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Cyclic quadrilateral theorem test.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Objective 5: Conditional Probability (LO-EDX-PROB-COND-01)
-- Item 9: DIAG-EDX-MATH-PROB-01
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000109',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000005',
    '00000010-0000-0000-0000-000000000005',
    '00000011-0000-0000-0000-000000000005',
    '00000008-0000-0000-0000-000000000003',
    'DIAG-EDX-MATH-PROB-01',
    'Higher',
    false,
    3,
    'STRUCTURED_MULTI_STEP',
    'Grade 7-8',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Non-replacement probability compound events.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000109',
    '00000013-0000-0000-0000-000000000109',
    'v1',
    'MULTIPLE_CHOICE',
    'A bag contains 5 red counters and 4 blue counters. A counter is taken at random and NOT replaced. A second counter is then taken at random. What is the probability that both counters are red?',
    '[
        {"id": "A", "text": "20/72 (or 5/18)", "distractor_rationale": "Correct: (5/9) * (4/8) = 20/72 = 5/18"},
        {"id": "B", "text": "25/81", "distractor_rationale": "Assumed replacement: (5/9) * (5/9)"},
        {"id": "C", "text": "9/17", "distractor_rationale": "Added numerators and denominators instead of multiplying"},
        {"id": "D", "text": "4/9", "distractor_rationale": "Calculated only single-event probability"}
    ]'::jsonb,
    'A',
    null,
    null,
    null,
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Tests without-replacement conditional logic.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Item 10: DIAG-EDX-MATH-PROB-02
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000110',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000005',
    '00000010-0000-0000-0000-000000000005',
    '00000011-0000-0000-0000-000000000005',
    '00000008-0000-0000-0000-000000000003',
    'DIAG-EDX-MATH-PROB-02',
    'Higher',
    false,
    3,
    'STRUCTURED_MULTI_STEP',
    'Grade 7-8',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Conditional probability from Venn subsets.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000110',
    '00000013-0000-0000-0000-000000000110',
    'v1',
    'SHORT_NUMERIC',
    'In a class of 30 students, 18 study French ($F$), 12 study German ($G$), and 6 study both. A student is selected at random from those who study French. What is the probability that this student also studies German? (Give decimal rounded to 4 d.p., e.g. 0.3333)',
    null,
    '0.3333',
    0.005,
    null,
    ARRAY['0.3333', '1/3', '6/18', '0.333'],
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'P(G|F) = 6 / 18 = 1/3 ≈ 0.3333.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Objective 6: Theoretical Base Probability (LO-EDX-PROB-BASE-01)
-- Item 11: DIAG-EDX-MATH-BASE-01
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000111',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000005',
    '00000010-0000-0000-0000-000000000006',
    '00000011-0000-0000-0000-000000000006',
    '00000008-0000-0000-0000-000000000001',
    'DIAG-EDX-MATH-BASE-01',
    'Foundation',
    false,
    2,
    'SHORT_PROCEDURAL',
    'Grade 1-3',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Simple single-event theoretical probability.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000111',
    '00000013-0000-0000-0000-000000000111',
    'v1',
    'SHORT_NUMERIC',
    'A fair six-sided dice numbered 1 to 6 is rolled once. What is the probability of rolling an even prime number? (Give decimal rounded to 4 d.p., e.g. 0.1667)',
    null,
    '0.1667',
    0.005,
    null,
    ARRAY['0.1667', '1/6', '0.167'],
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Even prime is only 2 => 1/6 ≈ 0.1667.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;

-- Item 12: DIAG-EDX-MATH-BASE-02
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES (
    '00000013-0000-0000-0000-000000000112',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000005',
    '00000010-0000-0000-0000-000000000006',
    '00000011-0000-0000-0000-000000000006',
    '00000008-0000-0000-0000-000000000001',
    'DIAG-EDX-MATH-BASE-02',
    'Common',
    false,
    2,
    'STRUCTURED_MULTI_STEP',
    'Grade 3-4',
    true,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Sample space grid for two independent spinners.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_item_content (
    id, assessment_item_id, version, content_format, prompt, options, canonical_answer,
    answer_tolerance, answer_unit, equivalent_representations, source_type, verification_status, notes
) VALUES (
    '00000014-0000-0000-0000-000000000112',
    '00000013-0000-0000-0000-000000000112',
    'v1',
    'MULTIPLE_CHOICE',
    'Two fair spinners are spun. Spinner A has numbers 1, 2, 3. Spinner B has numbers 1, 2, 3, 4. The scores are added together. How many total outcomes are in the sample space, and what is the probability of getting a total score of 5?',
    '[
        {"id": "A", "text": "12 total outcomes; probability = 3/12 (or 1/4)", "distractor_rationale": "Correct: 3 * 4 = 12 total outcomes, pairs giving 5 are (1,4), (2,3), (3,2)"},
        {"id": "B", "text": "7 total outcomes; probability = 1/7", "distractor_rationale": "Added outcome counts (3 + 4 = 7) instead of multiplying"},
        {"id": "C", "text": "12 total outcomes; probability = 2/12", "distractor_rationale": "Missed one of the permutations for sum 5"},
        {"id": "D", "text": "24 total outcomes; probability = 6/24", "distractor_rationale": "Double counted sample space"}
    ]'::jsonb,
    'A',
    null,
    null,
    null,
    'ORIGINAL_HOMEEDU',
    'VERIFIED_OFFICIAL',
    'Two-event sample space grid diagnostic.'
) ON CONFLICT (assessment_item_id, version) DO NOTHING;
