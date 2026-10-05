-- =============================================================================
-- HomeEdu Hub: Phase 2A Curriculum Knowledge Base Architecture Migration
-- Target Platform: Supabase (PostgreSQL 15+)
-- Grounded in the English Educational Framework Deep Research
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CURRICULUM SOURCES & PROVENANCE REGISTER
-- Ensures every curriculum entity is strictly traceable to its origin.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    publisher TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN (
        'OFFICIAL_REGULATION',
        'QUALIFICATION_SPECIFICATION',
        'STATUTORY_CURRICULUM',
        'SECONDARY_GUIDANCE',
        'RESEARCH_DOCUMENT',
        'UNVERIFIED_SOURCE'
    )),
    url TEXT,
    publication_date DATE,
    retrieved_date DATE,
    version TEXT,
    jurisdiction TEXT NOT NULL DEFAULT 'England',
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL',
        'SECONDARY_SOURCE',
        'DERIVED',
        'UNVERIFIED'
    )),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_curriculum_sources_modtime
    BEFORE UPDATE ON public.curriculum_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. CURRICULUM FRAMEWORKS
-- Differentiates between statutory state-school mandates and qualification frameworks.
-- (e.g. National Curriculum for England vs. Regulated Qualifications Framework)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    jurisdiction TEXT NOT NULL DEFAULT 'England',
    governing_body TEXT NOT NULL,
    description TEXT,
    is_statutory_for_maintained_schools BOOLEAN NOT NULL DEFAULT true,
    is_mandatory_for_ehe BOOLEAN NOT NULL DEFAULT false, -- Crucial legal distinction (Education Act 1996 s.7)
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_curriculum_frameworks_modtime
    BEFORE UPDATE ON public.curriculum_frameworks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. EDUCATION STAGES
-- (e.g. Key Stage 3, Key Stage 4 / GCSE, Post-16)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.education_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID REFERENCES public.curriculum_frameworks(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    typical_age_start INT NOT NULL,
    typical_age_end INT NOT NULL,
    year_groups TEXT[] NOT NULL,
    description TEXT,
    assessment_model TEXT NOT NULL,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_framework_stage UNIQUE (framework_id, code)
);

CREATE TRIGGER update_education_stages_modtime
    BEFORE UPDATE ON public.education_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. CURRICULUM SUBJECTS
-- Standard disciplines (e.g. Mathematics, English Language, Combined Science)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('Core', 'Foundation', 'Entitlement', 'Optional')),
    description TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_curriculum_subjects_modtime
    BEFORE UPDATE ON public.curriculum_subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. QUALIFICATIONS
-- Qualification types on the Regulated Qualifications Framework (RQF)
-- (e.g. GCSE (9 to 1), IGCSE, KS3 Core Programme, Entry Level, BTEC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    level TEXT NOT NULL,
    grading_scale TEXT NOT NULL,
    is_linear BOOLEAN NOT NULL DEFAULT true,
    has_tiering BOOLEAN NOT NULL DEFAULT false,
    default_glh_min INT,
    default_glh_max INT,
    default_tqt_min INT,
    default_tqt_max INT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_qualifications_modtime
    BEFORE UPDATE ON public.qualifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. EXAM BOARDS
-- Awarding Organisations accredited by Ofqual in England
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    regulatory_status TEXT NOT NULL,
    website_url TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_exam_boards_modtime
    BEFORE UPDATE ON public.exam_boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 7. SPECIFICATIONS
-- Independently versioned syllabus specifications issued by awarding bodies.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.curriculum_subjects(id) ON DELETE RESTRICT,
    qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE RESTRICT,
    exam_board_id UUID NOT NULL REFERENCES public.exam_boards(id) ON DELETE RESTRICT,
    stage_id UUID NOT NULL REFERENCES public.education_stages(id) ON DELETE RESTRICT,
    specification_code TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'Issue 1',
    is_current BOOLEAN NOT NULL DEFAULT true,
    effective_from DATE,
    effective_to DATE,
    accreditation_number TEXT,
    has_tiers BOOLEAN NOT NULL DEFAULT true,
    tiers_supported TEXT[] NOT NULL DEFAULT ARRAY['Foundation', 'Higher'],
    glh INT,
    tqt INT,
    assessment_structure JSONB,
    private_candidate_suitability TEXT NOT NULL CHECK (private_candidate_suitability IN (
        'HIGHLY_ACCESSIBLE',
        'ACCESSIBLE_WITH_ARRANGEMENTS',
        'RESTRICTED_NEA',
        'UNAVAILABLE'
    )),
    notes TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_spec_code_version UNIQUE (exam_board_id, specification_code, version)
);

CREATE TRIGGER update_specifications_modtime
    BEFORE UPDATE ON public.specifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 8. ASSESSMENT OBJECTIVES
-- Statutory cognitive constructs regulated by Ofqual per qualification/spec.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specification_id UUID NOT NULL REFERENCES public.specifications(id) ON DELETE CASCADE,
    qualification_id UUID REFERENCES public.qualifications(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    weighting_foundation NUMERIC(5,2),
    weighting_higher NUMERIC(5,2),
    weighting_untiered NUMERIC(5,2),
    tolerance NUMERIC(5,2),
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_spec_ao UNIQUE (specification_id, code)
);

CREATE TRIGGER update_assessment_objectives_modtime
    BEFORE UPDATE ON public.assessment_objectives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 9. CURRICULUM TOPICS (Hierarchical)
-- High-level syllabus domains and subtopics.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specification_id UUID NOT NULL REFERENCES public.specifications(id) ON DELETE CASCADE,
    parent_topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
    code TEXT,
    title TEXT NOT NULL,
    tier_eligibility TEXT NOT NULL CHECK (tier_eligibility IN ('Foundation', 'Higher', 'Both', 'Not applicable')) DEFAULT 'Both',
    sort_order INT NOT NULL DEFAULT 0,
    external_reference TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_curriculum_topics_modtime
    BEFORE UPDATE ON public.curriculum_topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 10. CONCEPTS
-- Atomic knowledge and skill units (decoupled from student performance state).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tier_eligibility TEXT NOT NULL CHECK (tier_eligibility IN ('Foundation', 'Higher', 'Both', 'Not applicable')) DEFAULT 'Both',
    cognitive_domain TEXT,
    estimated_guided_hours NUMERIC(4,1),
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_concepts_modtime
    BEFORE UPDATE ON public.concepts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 11. LEARNING OBJECTIVES
-- Explicit statements describing what the learner should know, understand, or execute.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    statement TEXT NOT NULL,
    primary_ao_id UUID REFERENCES public.assessment_objectives(id) ON DELETE SET NULL,
    tier_eligibility TEXT NOT NULL CHECK (tier_eligibility IN ('Foundation', 'Higher', 'Both', 'Not applicable')) DEFAULT 'Both',
    target_grade_min INT,
    target_grade_max INT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_learning_objectives_modtime
    BEFORE UPDATE ON public.learning_objectives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 12. PREREQUISITE RELATIONSHIPS
-- Disciplinary dependency graph (Concept A is required before Concept B).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prerequisite_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    prerequisite_concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'STRICT_PREREQUISITE',
        'RECOMMENDED_CO_REQUISITE',
        'DEVELOPMENTAL_EXTENSION'
    )),
    justification TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_prerequisite CHECK (concept_id != prerequisite_concept_id),
    CONSTRAINT unique_prerequisite_pair UNIQUE (concept_id, prerequisite_concept_id)
);

-- -----------------------------------------------------------------------------
-- 13. ASSESSMENT ITEMS (Structural Schema Only — No Copyrighted Question Content)
-- Captures metadata, marks, and target demand for assessment modelling.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specification_id UUID NOT NULL REFERENCES public.specifications(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
    primary_ao_id UUID REFERENCES public.assessment_objectives(id) ON DELETE SET NULL,
    item_reference TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('Foundation', 'Higher', 'Common', 'Untiered')),
    calculator_allowed BOOLEAN NOT NULL DEFAULT true,
    total_marks INT NOT NULL CHECK (total_marks > 0),
    item_type TEXT NOT NULL CHECK (item_type IN (
        'MULTIPLE_CHOICE',
        'SHORT_PROCEDURAL',
        'STRUCTURED_MULTI_STEP',
        'EXTENDED_REASONING',
        'INVESTIGATIVE_PRACTICAL'
    )),
    target_grade_band TEXT,
    is_common_targeted_question BOOLEAN NOT NULL DEFAULT false,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_assessment_items_modtime
    BEFORE UPDATE ON public.assessment_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 14. EXTEND STUDENT_SUBJECTS TABLE
-- Safely links a student's chosen subject to a specification in the knowledge base.
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

-- -----------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY (RLS) FOR CURRICULUM TABLES
-- Curriculum data is globally readable by all authenticated and anonymous clients.
-- Modifications are blocked for standard client connections.
-- -----------------------------------------------------------------------------
ALTER TABLE public.curriculum_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prerequisite_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;

-- Read-only global SELECT policies
CREATE POLICY "Public read curriculum_sources" ON public.curriculum_sources FOR SELECT USING (true);
CREATE POLICY "Public read curriculum_frameworks" ON public.curriculum_frameworks FOR SELECT USING (true);
CREATE POLICY "Public read education_stages" ON public.education_stages FOR SELECT USING (true);
CREATE POLICY "Public read curriculum_subjects" ON public.curriculum_subjects FOR SELECT USING (true);
CREATE POLICY "Public read qualifications" ON public.qualifications FOR SELECT USING (true);
CREATE POLICY "Public read exam_boards" ON public.exam_boards FOR SELECT USING (true);
CREATE POLICY "Public read specifications" ON public.specifications FOR SELECT USING (true);
CREATE POLICY "Public read assessment_objectives" ON public.assessment_objectives FOR SELECT USING (true);
CREATE POLICY "Public read curriculum_topics" ON public.curriculum_topics FOR SELECT USING (true);
CREATE POLICY "Public read concepts" ON public.concepts FOR SELECT USING (true);
CREATE POLICY "Public read learning_objectives" ON public.learning_objectives FOR SELECT USING (true);
CREATE POLICY "Public read prerequisite_relationships" ON public.prerequisite_relationships FOR SELECT USING (true);
CREATE POLICY "Public read assessment_items" ON public.assessment_items FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- 16. SEED DATA: OFFICIAL RESEARCH PROVENANCE & FIRST VERTICAL SLICE
-- GCSE Mathematics / Pearson Edexcel (1MA1) & National Curriculum KS3
-- -----------------------------------------------------------------------------

-- A. Sources
INSERT INTO public.curriculum_sources (
    id, source_code, title, publisher, source_type, url, publication_date, version, verification_status, notes
) VALUES
(
    '00000001-0000-0000-0000-000000000001',
    'OFQUAL_GCSE_MATHS_CONDITIONS_2022',
    'GCSE (9 to 1) Subject-Level Conditions and Requirements for Mathematics',
    'Ofqual',
    'OFFICIAL_REGULATION',
    'https://www.gov.uk/government/publications/gcse-9-to-1-subject-level-conditions-and-requirements-for-mathematics',
    '2022-04-01',
    'Ofqual/16/6127',
    'VERIFIED_OFFICIAL',
    'Statutory regulation defining mandatory AO weightings (AO1 50%/40%, AO2 25%/30%, AO3 25%/30%) and tiering boundaries.'
),
(
    '00000001-0000-0000-0000-000000000002',
    'PEARSON_EDEXCEL_1MA1_SPEC_2015',
    'Pearson Edexcel Level 1/Level 2 GCSE (9-1) in Mathematics (1MA1) Specification',
    'Pearson Edexcel',
    'QUALIFICATION_SPECIFICATION',
    'https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/specification-and-sample-assesment/gcse-maths-2015-specification.pdf',
    '2015-01-01',
    'Issue 2',
    'VERIFIED_OFFICIAL',
    'Accredited terminal examination specification for GCSE Mathematics. 3 papers of 80 marks each.'
),
(
    '00000001-0000-0000-0000-000000000003',
    'DFE_NAT_CURR_KS3_MATHS_2014',
    'National Curriculum in England: Secondary Curriculum - Key Stage 3 Mathematics',
    'Department for Education (DfE)',
    'STATUTORY_CURRICULUM',
    'https://www.gov.uk/government/publications/national-curriculum-in-england-secondary-curriculum',
    '2014-09-01',
    'DFE-00179-2013',
    'VERIFIED_OFFICIAL',
    'Statutory programmes of study for maintained schools. Non-statutory guidance for Elective Home Education (EHE).'
),
(
    '00000001-0000-0000-0000-000000000004',
    'EDUCATION_ACT_1996_SEC_7',
    'Education Act 1996: Section 7 - Duty of parents to secure education of children',
    'UK Parliament / The National Archives',
    'OFFICIAL_REGULATION',
    'https://www.legislation.gov.uk/ukpga/1996/56/section/7',
    '1996-07-24',
    '1996 c. 56',
    'VERIFIED_OFFICIAL',
    'Establishes legal right to home education ("or otherwise") without duty to follow the National Curriculum.'
)
ON CONFLICT (source_code) DO NOTHING;

-- B. Frameworks
INSERT INTO public.curriculum_frameworks (
    id, code, name, jurisdiction, governing_body, description, is_statutory_for_maintained_schools, is_mandatory_for_ehe, source_id, verification_status
) VALUES
(
    '00000002-0000-0000-0000-000000000001',
    'ENG_NATIONAL_CURRICULUM',
    'National Curriculum for England',
    'England',
    'Department for Education (DfE)',
    'Statutory framework for maintained local authority schools. Academies are exempt from detailed programmes of study; EHE parents have no legal obligation to follow it.',
    true,
    false,
    '00000001-0000-0000-0000-000000000004',
    'VERIFIED_OFFICIAL'
),
(
    '00000002-0000-0000-0000-000000000002',
    'RQF_ENGLAND',
    'Regulated Qualifications Framework (RQF)',
    'England',
    'Ofqual',
    'National framework indexing regulated public qualifications from Entry Level through Level 8.',
    true,
    false,
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (code) DO NOTHING;

-- C. Education Stages
INSERT INTO public.education_stages (
    id, framework_id, code, name, typical_age_start, typical_age_end, year_groups, description, assessment_model, source_id, verification_status
) VALUES
(
    '00000003-0000-0000-0000-000000000001',
    '00000002-0000-0000-0000-000000000001',
    'KS3',
    'Key Stage 3',
    11,
    14,
    ARRAY['Year 7', 'Year 8', 'Year 9'],
    'Lower secondary education. National numeric levels were abolished in 2014; schools and EHE employ assessment without levels.',
    'Decentralised assessment without national levels (competency & mastery progression)',
    '00000001-0000-0000-0000-000000000003',
    'VERIFIED_OFFICIAL'
),
(
    '00000003-0000-0000-0000-000000000002',
    '00000002-0000-0000-0000-000000000002',
    'KS4_GCSE',
    'Key Stage 4 / GCSE',
    14,
    16,
    ARRAY['Year 10', 'Year 11'],
    'Upper secondary qualification pathway leading to terminal General Certificate of Secondary Education examinations.',
    'Linear terminal examinations on 9 to 1 numerical scale (Ofqual Comparable Outcomes standard)',
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (framework_id, code) DO NOTHING;

-- D. Subjects
INSERT INTO public.curriculum_subjects (
    id, code, name, classification, description, source_id, verification_status
) VALUES
(
    '00000004-0000-0000-0000-000000000001',
    'MATHS',
    'Mathematics',
    'Core',
    'Mathematical reasoning, fluency, problem solving, algebra, geometry, probability, and statistics.',
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (code) DO NOTHING;

-- E. Qualifications
INSERT INTO public.qualifications (
    id, code, title, level, grading_scale, is_linear, has_tiering, default_glh_min, default_glh_max, default_tqt_min, default_tqt_max, source_id, verification_status
) VALUES
(
    '00000005-0000-0000-0000-000000000001',
    'GCSE_9_1',
    'General Certificate of Secondary Education (9 to 1)',
    'Level 1 / Level 2 (RQF)',
    '9 to 1 numerical scale (9 highest, 1 lowest pass, U unclassified)',
    true,
    true,
    120,
    140,
    140,
    150,
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
),
(
    '00000005-0000-0000-0000-000000000002',
    'KS3_CORE',
    'Key Stage 3 Core Programme',
    'Key Stage 3',
    'Competency descriptors without national levels',
    false,
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    '00000001-0000-0000-0000-000000000003',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (code) DO NOTHING;

-- F. Exam Boards
INSERT INTO public.exam_boards (
    id, code, name, regulatory_status, website_url, source_id, verification_status
) VALUES
(
    '00000006-0000-0000-0000-000000000001',
    'PEARSON_EDEXCEL',
    'Pearson Edexcel',
    'Ofqual Recognised Awarding Organisation',
    'https://qualifications.pearson.com',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000006-0000-0000-0000-000000000002',
    'AQA',
    'Assessment and Qualifications Alliance (AQA)',
    'Ofqual Recognised Awarding Organisation',
    'https://www.aqa.org.uk',
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
),
(
    '00000006-0000-0000-0000-000000000003',
    'OCR',
    'Oxford, Cambridge and RSA (OCR)',
    'Ofqual Recognised Awarding Organisation',
    'https://www.ocr.org.uk',
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
),
(
    '00000006-0000-0000-0000-000000000004',
    'EDUQAS',
    'WJEC Eduqas',
    'Ofqual Recognised Awarding Organisation',
    'https://www.eduqas.co.uk',
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
),
(
    '00000006-0000-0000-0000-000000000005',
    'DFE',
    'Department for Education',
    'Statutory Government Department',
    'https://www.gov.uk/government/organisations/department-for-education',
    '00000001-0000-0000-0000-000000000003',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (code) DO NOTHING;

-- G. Specifications
INSERT INTO public.specifications (
    id, subject_id, qualification_id, exam_board_id, stage_id, specification_code, title, version, is_current,
    effective_from, accreditation_number, has_tiers, tiers_supported, glh, tqt, assessment_structure,
    private_candidate_suitability, notes, source_id, verification_status
) VALUES
(
    '00000007-0000-0000-0000-000000000001',
    '00000004-0000-0000-0000-000000000001', -- Maths
    '00000005-0000-0000-0000-000000000001', -- GCSE (9 to 1)
    '00000006-0000-0000-0000-000000000001', -- Pearson Edexcel
    '00000003-0000-0000-0000-000000000002', -- KS4 / GCSE
    '1MA1',
    'Pearson Edexcel Level 1/Level 2 GCSE (9-1) in Mathematics (1MA1)',
    'Issue 2',
    true,
    '2015-09-01',
    '601/4700/3',
    true,
    ARRAY['Foundation', 'Higher'],
    130,
    140,
    '{
        "papers_count": 3,
        "total_marks": 240,
        "common_marks_min_percentage": 20,
        "paper_details": [
            {"paper_number": 1, "title": "Paper 1 (Non-Calculator)", "marks": 80, "duration_minutes": 90, "calculator_allowed": false, "weighting_percentage": 33.33},
            {"paper_number": 2, "title": "Paper 2 (Calculator)", "marks": 80, "duration_minutes": 90, "calculator_allowed": true, "weighting_percentage": 33.33},
            {"paper_number": 3, "title": "Paper 3 (Calculator)", "marks": 80, "duration_minutes": 90, "calculator_allowed": true, "weighting_percentage": 33.33}
        ]
    }'::jsonb,
    'HIGHLY_ACCESSIBLE',
    '100% written examination. No NEA or practical endorsement required. Ideal for private candidates and home educators.',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000007-0000-0000-0000-000000000002',
    '00000004-0000-0000-0000-000000000001', -- Maths
    '00000005-0000-0000-0000-000000000002', -- KS3 Core
    '00000006-0000-0000-0000-000000000005', -- DfE
    '00000003-0000-0000-0000-000000000001', -- KS3
    'DFE-KS3-MATHS',
    'National Curriculum: Mathematics Programme of Study (Key Stage 3)',
    '2014 Framework',
    true,
    '2014-09-01',
    'DFE-00179-2013',
    false,
    ARRAY['Not applicable'],
    NULL,
    NULL,
    '{
        "papers_count": 0,
        "total_marks": 0,
        "notes": "Decentralized formative assessment without national statutory test papers or levels."
    }'::jsonb,
    'HIGHLY_ACCESSIBLE',
    'Statutory for maintained schools. Serves as benchmark for foundational numeracy without terminal public exam barrier.',
    '00000001-0000-0000-0000-000000000003',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (exam_board_id, specification_code, version) DO NOTHING;

-- H. Assessment Objectives (for Pearson Edexcel GCSE Maths 1MA1)
INSERT INTO public.assessment_objectives (
    id, specification_id, qualification_id, code, title, description, weighting_foundation, weighting_higher, source_id, verification_status
) VALUES
(
    '00000008-0000-0000-0000-000000000001',
    '00000007-0000-0000-0000-000000000001',
    '00000005-0000-0000-0000-000000000001',
    'AO1',
    'Use and apply standard techniques',
    'Learners should be able to accurately recall facts, terminology and definitions; use and apply routine mathematical procedures and algorithms without prompting.',
    50.00,
    40.00,
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
),
(
    '00000008-0000-0000-0000-000000000002',
    '00000007-0000-0000-0000-000000000001',
    '00000005-0000-0000-0000-000000000001',
    'AO2',
    'Reason, interpret and communicate mathematically',
    'Learners should be able to make inferences and deductions; construct chains of mathematical reasoning and arguments; interpret and evaluate solutions and geometric/algebraic proofs.',
    25.00,
    30.00,
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
),
(
    '00000008-0000-0000-0000-000000000003',
    '00000007-0000-0000-0000-000000000001',
    '00000005-0000-0000-0000-000000000001',
    'AO3',
    'Solve problems within mathematics and in other contexts',
    'Learners should be able to translate non-routine problems in mathematical or other contexts into a process or series of mathematical processes; make and evaluate multi-step plans.',
    25.00,
    30.00,
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (specification_id, code) DO NOTHING;

-- I. Curriculum Topics (Pearson Edexcel 1MA1 6 Core Domains)
INSERT INTO public.curriculum_topics (
    id, specification_id, parent_topic_id, code, title, tier_eligibility, sort_order, external_reference, source_id, verification_status
) VALUES
(
    '00000009-0000-0000-0000-000000000001',
    '00000007-0000-0000-0000-000000000001',
    NULL,
    'N',
    'Number',
    'Both',
    10,
    '1MA1 Section 1',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000009-0000-0000-0000-000000000002',
    '00000007-0000-0000-0000-000000000001',
    NULL,
    'A',
    'Algebra',
    'Both',
    20,
    '1MA1 Section 2',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000009-0000-0000-0000-000000000003',
    '00000007-0000-0000-0000-000000000001',
    NULL,
    'R',
    'Ratio, Proportion and Rates of Change',
    'Both',
    30,
    '1MA1 Section 3',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000009-0000-0000-0000-000000000004',
    '00000007-0000-0000-0000-000000000001',
    NULL,
    'G',
    'Geometry and Measures',
    'Both',
    40,
    '1MA1 Section 4',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000009-0000-0000-0000-000000000005',
    '00000007-0000-0000-0000-000000000001',
    NULL,
    'P',
    'Probability',
    'Both',
    50,
    '1MA1 Section 5',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000009-0000-0000-0000-000000000006',
    '00000007-0000-0000-0000-000000000001',
    NULL,
    'S',
    'Statistics',
    'Both',
    60,
    '1MA1 Section 6',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT DO NOTHING;

-- J. Concepts (Verified Vertical Slice from Research)
INSERT INTO public.concepts (
    id, topic_id, code, title, description, tier_eligibility, cognitive_domain, estimated_guided_hours, source_id, verification_status
) VALUES
(
    '00000010-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000002', -- Algebra
    'EDX-MATH-ALG-LIN-01',
    'Solving Linear Equations in One Unknown',
    'Solving linear equations with variables on one or both sides, including those involving brackets and simple fractional terms.',
    'Both',
    'Algebraic Manipulation',
    4.0,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000010-0000-0000-0000-000000000002',
    '00000009-0000-0000-0000-000000000002', -- Algebra
    'EDX-MATH-ALG-QUAD-01',
    'Solving Quadratic Equations Algebraically',
    'Factorising quadratic expressions into two linear brackets, using the quadratic formula, and completing the square for Higher tier.',
    'Both',
    'Algebraic Manipulation',
    6.0,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000010-0000-0000-0000-000000000003',
    '00000009-0000-0000-0000-000000000004', -- Geometry
    'EDX-MATH-GEO-VEC-01',
    'Vector Arithmetic and Geometric Proofs',
    'Representing vectors column-wise, performing vector addition/scalar multiplication, and constructing formal geometric vector proofs. Higher tier only.',
    'Higher',
    'Geometric Reasoning',
    5.0,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000010-0000-0000-0000-000000000004',
    '00000009-0000-0000-0000-000000000004', -- Geometry
    'EDX-MATH-GEO-CIRC-01',
    'Circle Theorems and Formal Angle Deductions',
    'Applying circle theorems (angles in same segment, angle at centre is twice angle at circumference, alternate segment theorem) to deduce proofs. Higher tier only.',
    'Higher',
    'Geometric Reasoning',
    6.0,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000010-0000-0000-0000-000000000005',
    '00000009-0000-0000-0000-000000000005', -- Probability
    'EDX-MATH-PROB-COND-01',
    'Conditional Probability and Multi-Event Models',
    'Determining conditional probabilities from Venn diagrams, two-way tables, and tree diagrams (without replacement). Higher tier only.',
    'Higher',
    'Statistical Reasoning',
    4.5,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000010-0000-0000-0000-000000000006',
    '00000009-0000-0000-0000-000000000005', -- Probability
    'EDX-MATH-PROB-BASE-01',
    'Theoretical Probability and Sample Space Diagrams',
    'Calculating single and independent combined event probabilities using fractions, decimals, and sample space grids.',
    'Both',
    'Statistical Reasoning',
    3.5,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (code) DO NOTHING;

-- K. Learning Objectives
INSERT INTO public.learning_objectives (
    id, concept_id, code, statement, primary_ao_id, tier_eligibility, target_grade_min, target_grade_max, source_id, verification_status
) VALUES
(
    '00000011-0000-0000-0000-000000000001',
    '00000010-0000-0000-0000-000000000001',
    'LO-EDX-ALG-LIN-01',
    'Solve linear equations algebraically, including with unknowns on both sides and with fractional expressions.',
    '00000008-0000-0000-0000-000000000001', -- AO1
    'Both',
    3,
    5,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000011-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000002',
    'LO-EDX-ALG-QUAD-01',
    'Solve quadratic equations of the form ax^2 + bx + c = 0 algebraically by factorisation.',
    '00000008-0000-0000-0000-000000000001', -- AO1
    'Both',
    4,
    6,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000011-0000-0000-0000-000000000003',
    '00000010-0000-0000-0000-000000000003',
    'LO-EDX-GEO-VEC-01',
    'Use vectors to construct geometric proofs involving collinear points, parallel vectors, and ratios.',
    '00000008-0000-0000-0000-000000000002', -- AO2
    'Higher',
    7,
    9,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000011-0000-0000-0000-000000000004',
    '00000010-0000-0000-0000-000000000004',
    'LO-EDX-GEO-CIRC-01',
    'Apply circle theorems to deduce unknown angles and construct formal mathematical arguments.',
    '00000008-0000-0000-0000-000000000002', -- AO2
    'Higher',
    7,
    9,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000011-0000-0000-0000-000000000005',
    '00000010-0000-0000-0000-000000000005',
    'LO-EDX-PROB-COND-01',
    'Calculate and interpret conditional probabilities using tree diagrams without replacement and Venn diagrams.',
    '00000008-0000-0000-0000-000000000003', -- AO3
    'Higher',
    7,
    9,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000011-0000-0000-0000-000000000006',
    '00000010-0000-0000-0000-000000000006',
    'LO-EDX-PROB-BASE-01',
    'Record and describe the outcomes of simple probability experiments using tables, frequency trees, and grids.',
    '00000008-0000-0000-0000-000000000001', -- AO1
    'Both',
    1,
    4,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT DO NOTHING;

-- L. Prerequisite Relationships (Disciplinary Hierarchy)
INSERT INTO public.prerequisite_relationships (
    id, concept_id, prerequisite_concept_id, relationship_type, justification, source_id, verification_status
) VALUES
(
    '00000012-0000-0000-0000-000000000001',
    '00000010-0000-0000-0000-000000000002', -- Quadratic Equations
    '00000010-0000-0000-0000-000000000001', -- Linear Equations
    'STRICT_PREREQUISITE',
    'Algebraic manipulation of linear equations and null-factor law are mathematically essential prior to solving quadratics.',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
),
(
    '00000012-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000005', -- Conditional Probability
    '00000010-0000-0000-0000-000000000006', -- Theoretical Base Probability
    'STRICT_PREREQUISITE',
    'Understanding sample spaces and mutually exclusive probability axioms is strictly required before conditional non-replacement calculation.',
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (concept_id, prerequisite_concept_id) DO NOTHING;

-- M. Assessment Items (Structural Schema Demonstration — NO COPYRIGHT QUESTION TEXT)
INSERT INTO public.assessment_items (
    id, specification_id, topic_id, concept_id, learning_objective_id, primary_ao_id, item_reference,
    tier, calculator_allowed, total_marks, item_type, target_grade_band, is_common_targeted_question,
    source_id, verification_status, notes
) VALUES
(
    '00000013-0000-0000-0000-000000000001',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000001',
    '00000011-0000-0000-0000-000000000001',
    '00000008-0000-0000-0000-000000000001',
    'EDEXCEL-1MA1-1F-STRUCT-01',
    'Foundation',
    false,
    2,
    'SHORT_PROCEDURAL',
    'Grade 1-3',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Structural reference archetype: Single variable linear step equation on Paper 1 Non-Calculator.'
),
(
    '00000013-0000-0000-0000-000000000002',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000002',
    '00000010-0000-0000-0000-000000000002',
    '00000011-0000-0000-0000-000000000002',
    '00000008-0000-0000-0000-000000000003',
    'EDEXCEL-1MA1-COMMON-STRUCT-01',
    'Common',
    false,
    4,
    'STRUCTURED_MULTI_STEP',
    'Grade 4-5',
    true, -- Ofqual Common Tier Question Rule (>=20% of marks targeting grades 4 & 5 across tiers)
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL',
    'Structural archetype: Common overlap question targeting the Grade 4/5 boundary, linking Foundation and Higher tier standard setting.'
),
(
    '00000013-0000-0000-0000-000000000003',
    '00000007-0000-0000-0000-000000000001',
    '00000009-0000-0000-0000-000000000004',
    '00000010-0000-0000-0000-000000000004',
    '00000011-0000-0000-0000-000000000004',
    '00000008-0000-0000-0000-000000000002',
    'EDEXCEL-1MA1-2H-STRUCT-01',
    'Higher',
    true,
    5,
    'EXTENDED_REASONING',
    'Grade 8-9',
    false,
    '00000001-0000-0000-0000-000000000002',
    'VERIFIED_OFFICIAL',
    'Structural archetype: Higher-tier terminal geometric proof combining circle theorems and algebraic reasoning.'
)
ON CONFLICT DO NOTHING;
