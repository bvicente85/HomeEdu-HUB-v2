-- =============================================================================
-- HomeEdu Hub: Phase 2A.1 Curriculum Knowledge Base Validation & Normalisation
-- Corrections Applied:
-- 1. DfE is a Regulatory Authority, NOT an Exam Board / Awarding Organisation.
-- 2. KS3 is an Education Stage / Programme of Study, NOT a Qualification.
-- 3. Specifications explicitly model Programme Type and Coverage Status (Partial Vertical Slice).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. REGULATORY AUTHORITIES TABLE
-- Represents ministerial departments and independent regulators (DfE, Ofqual).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regulatory_authorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    authority_type TEXT NOT NULL CHECK (authority_type IN (
        'MINISTERIAL_DEPARTMENT',
        'INDEPENDENT_REGULATOR',
        'STATUTORY_AGENCY'
    )),
    jurisdiction TEXT NOT NULL DEFAULT 'England',
    website_url TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL',
        'SECONDARY_SOURCE',
        'DERIVED',
        'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_regulatory_authorities_modtime
    BEFORE UPDATE ON public.regulatory_authorities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.regulatory_authorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read regulatory_authorities" ON public.regulatory_authorities FOR SELECT USING (true);

-- Seed Authorities
INSERT INTO public.regulatory_authorities (
    id, code, name, authority_type, jurisdiction, website_url, source_id, verification_status
) VALUES
(
    '00000006-0000-0000-0000-000000000005',
    'DFE',
    'Department for Education (DfE)',
    'MINISTERIAL_DEPARTMENT',
    'England',
    'https://www.gov.uk/government/organisations/department-for-education',
    '00000001-0000-0000-0000-000000000003',
    'VERIFIED_OFFICIAL'
),
(
    '00000006-0000-0000-0000-000000000006',
    'OFQUAL',
    'Office of Qualifications and Examinations Regulation (Ofqual)',
    'INDEPENDENT_REGULATOR',
    'England',
    'https://www.gov.uk/government/organisations/ofqual',
    '00000001-0000-0000-0000-000000000001',
    'VERIFIED_OFFICIAL'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    authority_type = EXCLUDED.authority_type;

-- -----------------------------------------------------------------------------
-- 2. NORMALISE SPECIFICATIONS SCHEMA
-- Differentiates Qualification Specifications from National Curriculum Programmes.
-- -----------------------------------------------------------------------------

-- Add Programme Type & Authority Columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'programme_type'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN programme_type TEXT NOT NULL DEFAULT 'QUALIFICATION_SPECIFICATION'
        CHECK (programme_type IN ('QUALIFICATION_SPECIFICATION', 'NATIONAL_CURRICULUM_PROGRAMME'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'authority_id'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN authority_id UUID REFERENCES public.regulatory_authorities(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'framework_id'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN framework_id UUID REFERENCES public.curriculum_frameworks(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'coverage_status'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN coverage_status TEXT NOT NULL DEFAULT 'PARTIAL_VERTICAL_SLICE'
        CHECK (coverage_status IN ('PARTIAL_VERTICAL_SLICE', 'STRUCTURAL_ONLY', 'COMPLETE', 'REQUIRES_VERIFICATION'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'regulatory_conditions_source_id'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN regulatory_conditions_source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'regulatory_conditions_reference'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN regulatory_conditions_reference TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'current_status_verified_date'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN current_status_verified_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'specifications' AND column_name = 'current_status_provenance'
    ) THEN
        ALTER TABLE public.specifications
        ADD COLUMN current_status_provenance TEXT;
    END IF;
END $$;

-- Drop foreign key NOT NULL constraints so National Curriculum Programmes are not forced into qualifications/exam boards
ALTER TABLE public.specifications ALTER COLUMN qualification_id DROP NOT NULL;
ALTER TABLE public.specifications ALTER COLUMN exam_board_id DROP NOT NULL;

-- Migrate KS3 National Curriculum Record to Authority Model
UPDATE public.specifications
SET
    programme_type = 'NATIONAL_CURRICULUM_PROGRAMME',
    qualification_id = NULL,
    exam_board_id = NULL,
    authority_id = '00000006-0000-0000-0000-000000000005', -- DfE
    framework_id = '00000002-0000-0000-0000-000000000001', -- National Curriculum for England
    coverage_status = 'STRUCTURAL_ONLY',
    regulatory_conditions_source_id = '00000001-0000-0000-0000-000000000003',
    regulatory_conditions_reference = 'Education Act 2002 Section 84: National Curriculum in England: Secondary Curriculum (DFE-00179-2013)',
    current_status_verified_date = '2026-10-04',
    current_status_provenance = 'Verified active statutory instrument for maintained schools; non-statutory reference standard for Elective Home Education.',
    notes = 'Statutory Programme of Study for maintained schools in England (Key Stage 3 Mathematics). Established under Section 84 of the Education Act 2002. Not an exam-board specification or qualification.'
WHERE specification_code = 'DFE-KS3-MATHS';

-- Update GCSE Edexcel 1MA1 Record to explicitly reflect Partial Vertical Slice
UPDATE public.specifications
SET
    programme_type = 'QUALIFICATION_SPECIFICATION',
    authority_id = NULL,
    framework_id = '00000002-0000-0000-0000-000000000002', -- Regulated Qualifications Framework (RQF)
    coverage_status = 'PARTIAL_VERTICAL_SLICE',
    regulatory_conditions_source_id = '00000001-0000-0000-0000-000000000001',
    regulatory_conditions_reference = 'Ofqual/16/6127: GCSE (9 to 1) Subject-Level Conditions and Requirements for Mathematics',
    current_status_verified_date = '2026-10-04',
    current_status_provenance = 'Verified active for current terminal GCSE examination cohorts against Ofqual Register of Regulated Qualifications and Pearson Qualifications official specification portal.',
    notes = 'Architectural Partial Vertical Slice: Contains 6 verified concepts and learning objectives to validate relational hierarchy, tiering restrictions, and prerequisite logic. This does NOT represent the complete Pearson Edexcel GCSE (9-1) Mathematics specification.'
WHERE specification_code = '1MA1';

-- Delete DfE from exam_boards (It is a regulatory authority, NOT an awarding organisation)
DELETE FROM public.exam_boards WHERE code = 'DFE';

-- Delete KS3_CORE from qualifications (KS3 is an education stage / framework context, NOT a qualification)
DELETE FROM public.qualifications WHERE code = 'KS3_CORE';

-- Add Architectural Integrity Constraint
ALTER TABLE public.specifications DROP CONSTRAINT IF EXISTS chk_programme_ownership;
ALTER TABLE public.specifications
ADD CONSTRAINT chk_programme_ownership CHECK (
    (programme_type = 'QUALIFICATION_SPECIFICATION' AND qualification_id IS NOT NULL AND exam_board_id IS NOT NULL AND authority_id IS NULL) OR
    (programme_type = 'NATIONAL_CURRICULUM_PROGRAMME' AND qualification_id IS NULL AND exam_board_id IS NULL AND authority_id IS NOT NULL)
);

-- Replace old unique constraint with separate partial indexes
ALTER TABLE public.specifications DROP CONSTRAINT IF EXISTS unique_spec_code_version;
CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_exam_board_version
    ON public.specifications (exam_board_id, specification_code, version)
    WHERE exam_board_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_authority_version
    ON public.specifications (authority_id, specification_code, version)
    WHERE authority_id IS NOT NULL;
