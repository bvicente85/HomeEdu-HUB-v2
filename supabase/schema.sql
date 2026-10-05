-- =============================================================================
-- HomeEdu Hub: Phase 1 Database Schema & Row Level Security (RLS)
-- Target Platform: Supabase (PostgreSQL 15+)
-- British English Education Conventions (KS3, GCSE, Year 7-11)
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. HELPER FUNCTIONS: Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3. PROFILES TABLE
-- Extends Supabase auth.users with user role and display names.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. FAMILIES TABLE
-- Conceptual grouping for the household; enables multi-family scaling in future.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_families_modtime
    BEFORE UPDATE ON public.families
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. FAMILY_MEMBERS TABLE
-- Maps authenticated profiles to families with their respective role.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_family_member UNIQUE (family_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_profile ON public.family_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);

-- -----------------------------------------------------------------------------
-- 6. STUDENTS TABLE
-- Student academic profile (Personal details, Educational stage, GCSE status).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    date_of_birth DATE,
    education_type TEXT NOT NULL CHECK (
        education_type IN ('Mainstream school', 'Online school', 'Home education', 'College', 'Other')
    ),
    year_group TEXT NOT NULL CHECK (
        year_group IN ('Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Post-16', 'Other')
    ),
    gcse_status TEXT NOT NULL CHECK (
        gcse_status IN (
            'Not currently studying GCSEs',
            'Preparing for GCSEs',
            'Currently studying GCSEs',
            'Retaking GCSEs',
            'Not applicable'
        )
    ),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_family ON public.students(family_id);
CREATE INDEX IF NOT EXISTS idx_students_profile ON public.students(profile_id);

CREATE TRIGGER update_students_modtime
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 7. STUDENT_SUBJECTS TABLE
-- Subjects studied by the student, with qualifications and exam board details.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    qualification TEXT NOT NULL CHECK (
        qualification IN ('GCSE', 'IGCSE', 'KS3 Core', 'Entry Level', 'BTEC', 'Other')
    ),
    exam_board TEXT NOT NULL CHECK (
        exam_board IN ('AQA', 'Edexcel / Pearson', 'OCR', 'WJEC / Eduqas', 'Cambridge CIE', 'Not applicable', 'Other')
    ),
    specification_id UUID REFERENCES public.specifications(id) ON DELETE SET NULL,
    specification_code TEXT,
    tier TEXT CHECK (tier IS NULL OR tier IN ('Higher', 'Foundation', 'Not applicable')),
    target_exam_year INTEGER CHECK (target_exam_year IS NULL OR (target_exam_year >= 2024 AND target_exam_year <= 2040)),
    status TEXT NOT NULL CHECK (status IN ('Active', 'Completed', 'Paused', 'Planned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON public.student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_specification ON public.student_subjects(specification_id);

CREATE TRIGGER update_student_subjects_modtime
    BEFORE UPDATE ON public.student_subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict least-privilege security model.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current authenticated user is parent in a family
CREATE OR REPLACE FUNCTION public.is_parent_in_family(f_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = f_id
          AND profile_id = auth.uid()
          AND role = 'parent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper security function: Check if current authenticated user is member of a family
CREATE OR REPLACE FUNCTION public.is_member_of_family(f_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = f_id
          AND profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper security function: Check if current authenticated user is the creator of a family
CREATE OR REPLACE FUNCTION public.is_family_creator(f_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.families
        WHERE id = f_id
          AND created_by = auth.uid()
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- PROFILES POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile or family members" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can view their own profile, or parents can view profiles of their family members
CREATE POLICY "Users can read own profile or family members"
ON public.profiles FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.family_members fm1
        JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
        WHERE fm1.profile_id = auth.uid()
          AND fm2.profile_id = profiles.id
    )
);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- IMMUTABLE ROLE TRIGGER (Protects profiles.role against escalation)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Role modification is forbidden. User roles are immutable.';
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();

-- -----------------------------------------------------------------------------
-- AUTOMATED PROFILE PROVISIONING TRIGGER (Auth -> Profiles)
-- Seamlessly provisions profile row upon user creation (handles email confirmation).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, email)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'User'),
        'parent', -- Public signups strictly default to 'parent'
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- FAMILIES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Members and creator can view their family"
ON public.families FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()
    OR public.is_member_of_family(id)
);

CREATE POLICY "Authenticated users can create family"
ON public.families FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Parents can update their family"
ON public.families FOR UPDATE
USING (public.is_parent_in_family(id))
WITH CHECK (public.is_parent_in_family(id));

-- -----------------------------------------------------------------------------
-- FAMILY_MEMBERS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Members can view membership in their family"
ON public.family_members FOR SELECT
USING (public.is_member_of_family(family_id));

CREATE POLICY "Parents can add members or creator can add initial self"
ON public.family_members FOR INSERT
TO authenticated
WITH CHECK (
    public.is_parent_in_family(family_id)
    OR (
        profile_id = auth.uid()
        AND public.is_family_creator(family_id)
    )
);

CREATE POLICY "Parents can remove family members"
ON public.family_members FOR DELETE
USING (public.is_parent_in_family(family_id));

-- -----------------------------------------------------------------------------
-- STUDENTS POLICIES
-- -----------------------------------------------------------------------------
-- Parents in family OR linked student can view the student record
CREATE POLICY "Family members can view student records"
ON public.students FOR SELECT
USING (
    public.is_member_of_family(family_id)
    OR profile_id = auth.uid()
);

-- Only parents can create, update, or remove student records
CREATE POLICY "Parents can insert student records"
ON public.students FOR INSERT
WITH CHECK (public.is_parent_in_family(family_id));

CREATE POLICY "Parents can update student records"
ON public.students FOR UPDATE
USING (public.is_parent_in_family(family_id))
WITH CHECK (public.is_parent_in_family(family_id));

CREATE POLICY "Parents can delete student records"
ON public.students FOR DELETE
USING (public.is_parent_in_family(family_id));

-- -----------------------------------------------------------------------------
-- STUDENT_SUBJECTS POLICIES
-- -----------------------------------------------------------------------------
-- Any family member or the student can view the subjects
CREATE POLICY "Family members can view student subjects"
ON public.student_subjects FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_subjects.student_id
          AND (public.is_member_of_family(s.family_id) OR s.profile_id = auth.uid())
    )
);

-- Only parents can insert, update, or delete subjects
CREATE POLICY "Parents can insert student subjects"
ON public.student_subjects FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_subjects.student_id
          AND public.is_parent_in_family(s.family_id)
    )
);

CREATE POLICY "Parents can update student subjects"
ON public.student_subjects FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_subjects.student_id
          AND public.is_parent_in_family(s.family_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_subjects.student_id
          AND public.is_parent_in_family(s.family_id)
    )
);

CREATE POLICY "Parents can delete student subjects"
ON public.student_subjects FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_subjects.student_id
          AND public.is_parent_in_family(s.family_id)
    )
);

-- =============================================================================
-- 9. SUPABASE STORAGE (STUDENT EVIDENCE BUCKET PREPARATION)
-- Private bucket for future student work, certificates, and portfolio items.
-- MUST NEVER BE PUBLIC.
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-evidence',
    'student-evidence',
    false,
    26214400, -- 25MB max per item
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/mpeg', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policy: Authenticated family members can view evidence belonging to their family
CREATE POLICY "Family members can read student evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-evidence'
    AND (
        -- Path pattern: family_id/student_id/filename
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = (storage.foldername(name))[1]::UUID
              AND profile_id = auth.uid()
        )
    )
);

-- Storage Policy: Only parents or student can upload evidence into their family folder
CREATE POLICY "Family members can upload student evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'student-evidence'
    AND EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = (storage.foldername(name))[1]::UUID
          AND profile_id = auth.uid()
    )
);

-- =============================================================================
-- PHASE 2A: CURRICULUM KNOWLEDGE BASE ARCHITECTURE
-- Grounded in the English Educational Framework Deep Research
-- =============================================================================

-- 1. Curriculum Sources & Provenance Register
CREATE TABLE IF NOT EXISTS public.curriculum_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    publisher TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN (
        'OFFICIAL_REGULATION', 'QUALIFICATION_SPECIFICATION', 'STATUTORY_CURRICULUM',
        'SECONDARY_GUIDANCE', 'RESEARCH_DOCUMENT', 'UNVERIFIED_SOURCE'
    )),
    url TEXT,
    publication_date DATE,
    retrieved_date DATE,
    version TEXT,
    jurisdiction TEXT NOT NULL DEFAULT 'England',
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Curriculum Frameworks
CREATE TABLE IF NOT EXISTS public.curriculum_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    jurisdiction TEXT NOT NULL DEFAULT 'England',
    governing_body TEXT NOT NULL,
    description TEXT,
    is_statutory_for_maintained_schools BOOLEAN NOT NULL DEFAULT true,
    is_mandatory_for_ehe BOOLEAN NOT NULL DEFAULT false,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Education Stages
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

-- 4. Curriculum Subjects
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

-- 5. Qualifications
-- RQF-regulated qualifications (GCSE, IGCSE, BTEC, Entry Level).
-- KS3 is an education stage / framework context, NOT a qualification.
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

-- 6. Regulatory Authorities
-- Ministerial departments and statutory regulators (DfE, Ofqual).
CREATE TABLE IF NOT EXISTS public.regulatory_authorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    authority_type TEXT NOT NULL CHECK (authority_type IN (
        'MINISTERIAL_DEPARTMENT', 'INDEPENDENT_REGULATOR', 'STATUTORY_AGENCY'
    )),
    jurisdiction TEXT NOT NULL DEFAULT 'England',
    website_url TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Exam Boards / Awarding Organisations
-- Ofqual-recognised awarding bodies (Pearson Edexcel, AQA, OCR, Eduqas, CIE).
-- Does NOT include statutory government departments like DfE.
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

-- 8. Specifications & Programmes of Study
CREATE TABLE IF NOT EXISTS public.specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_type TEXT NOT NULL DEFAULT 'QUALIFICATION_SPECIFICATION' CHECK (programme_type IN (
        'QUALIFICATION_SPECIFICATION', 'NATIONAL_CURRICULUM_PROGRAMME'
    )),
    subject_id UUID NOT NULL REFERENCES public.curriculum_subjects(id) ON DELETE RESTRICT,
    qualification_id UUID REFERENCES public.qualifications(id) ON DELETE RESTRICT,
    exam_board_id UUID REFERENCES public.exam_boards(id) ON DELETE RESTRICT,
    authority_id UUID REFERENCES public.regulatory_authorities(id) ON DELETE RESTRICT,
    framework_id UUID REFERENCES public.curriculum_frameworks(id) ON DELETE RESTRICT,
    stage_id UUID NOT NULL REFERENCES public.education_stages(id) ON DELETE RESTRICT,
    specification_code TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'Issue 1',
    is_current BOOLEAN NOT NULL DEFAULT true,
    effective_from DATE,
    effective_to DATE,
    regulatory_conditions_source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    regulatory_conditions_reference TEXT,
    current_status_verified_date DATE,
    current_status_provenance TEXT,
    accreditation_number TEXT,
    has_tiers BOOLEAN NOT NULL DEFAULT true,
    tiers_supported TEXT[] NOT NULL DEFAULT ARRAY['Foundation', 'Higher'],
    glh INT,
    tqt INT,
    assessment_structure JSONB,
    private_candidate_suitability TEXT NOT NULL CHECK (private_candidate_suitability IN (
        'HIGHLY_ACCESSIBLE', 'ACCESSIBLE_WITH_ARRANGEMENTS', 'RESTRICTED_NEA', 'UNAVAILABLE'
    )),
    coverage_status TEXT NOT NULL DEFAULT 'PARTIAL_VERTICAL_SLICE' CHECK (coverage_status IN (
        'PARTIAL_VERTICAL_SLICE', 'STRUCTURAL_ONLY', 'COMPLETE', 'REQUIRES_VERIFICATION'
    )),
    notes TEXT,
    source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'VERIFIED_OFFICIAL', 'SECONDARY_SOURCE', 'DERIVED', 'UNVERIFIED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_programme_ownership CHECK (
        (programme_type = 'QUALIFICATION_SPECIFICATION' AND qualification_id IS NOT NULL AND exam_board_id IS NOT NULL AND authority_id IS NULL) OR
        (programme_type = 'NATIONAL_CURRICULUM_PROGRAMME' AND qualification_id IS NULL AND exam_board_id IS NULL AND authority_id IS NOT NULL)
    )
);

-- 8. Assessment Objectives
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

-- 9. Curriculum Topics
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

-- 10. Concepts
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

-- 11. Learning Objectives
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

-- 12. Prerequisite Relationships
CREATE TABLE IF NOT EXISTS public.prerequisite_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    prerequisite_concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'STRICT_PREREQUISITE', 'RECOMMENDED_CO_REQUISITE', 'DEVELOPMENTAL_EXTENSION'
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

-- 13. Assessment Items (Structural Schema Only)
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
        'MULTIPLE_CHOICE', 'SHORT_PROCEDURAL', 'STRUCTURED_MULTI_STEP',
        'EXTENDED_REASONING', 'INVESTIGATIVE_PRACTICAL'
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

-- 14. Assessment Item Content (Deliverable Questions & Answer Models)
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

-- 15. Global RLS for Curriculum Tables
ALTER TABLE public.curriculum_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prerequisite_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_item_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read curriculum_sources" ON public.curriculum_sources FOR SELECT USING (true);
CREATE POLICY "Public read curriculum_frameworks" ON public.curriculum_frameworks FOR SELECT USING (true);
CREATE POLICY "Public read education_stages" ON public.education_stages FOR SELECT USING (true);
CREATE POLICY "Public read curriculum_subjects" ON public.curriculum_subjects FOR SELECT USING (true);
CREATE POLICY "Public read qualifications" ON public.qualifications FOR SELECT USING (true);
CREATE POLICY "Public read regulatory_authorities" ON public.regulatory_authorities FOR SELECT USING (true);
CREATE POLICY "Public read exam_boards" ON public.exam_boards FOR SELECT USING (true);
CREATE POLICY "Public read specifications" ON public.specifications FOR SELECT USING (true);
CREATE POLICY "Public read assessment_objectives" ON public.assessment_objectives FOR SELECT USING (true);
CREATE POLICY "Public read curriculum_topics" ON public.curriculum_topics FOR SELECT USING (true);
CREATE POLICY "Public read concepts" ON public.concepts FOR SELECT USING (true);
CREATE POLICY "Public read learning_objectives" ON public.learning_objectives FOR SELECT USING (true);
CREATE POLICY "Public read prerequisite_relationships" ON public.prerequisite_relationships FOR SELECT USING (true);
CREATE POLICY "Public read assessment_items" ON public.assessment_items FOR SELECT USING (true);
CREATE POLICY "Public read assessment_item_content" ON public.assessment_item_content FOR SELECT USING (true);

-- =============================================================================
-- 15. PHASE 2B: STUDENT LEARNING STATE & DIAGNOSTIC BASELINE ARCHITECTURE
-- =============================================================================

-- Security helper functions
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

-- Student Learning States
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

-- Diagnostic Sessions
CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_subject_id UUID REFERENCES public.student_subjects(id) ON DELETE SET NULL,
    specification_id UUID REFERENCES public.specifications(id) ON DELETE SET NULL,
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

-- Diagnostic Targets
CREATE TABLE IF NOT EXISTS public.diagnostic_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
    learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE,
    target_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ASSESSED', 'SKIPPED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diag_targets_session ON public.diagnostic_targets(session_id, target_order);
CREATE INDEX IF NOT EXISTS idx_diag_targets_lo ON public.diagnostic_targets(learning_objective_id);

-- Learning Evidence
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

-- Assessment Attempts
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

-- Learning State History
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

-- RLS Configuration
ALTER TABLE public.student_learning_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_state_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view student learning states"
ON public.student_learning_states FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

CREATE POLICY "Parents can insert student learning states"
ON public.student_learning_states FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));

CREATE POLICY "Parents can update student learning states"
ON public.student_learning_states FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

CREATE POLICY "Parents can delete student learning states"
ON public.student_learning_states FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

CREATE POLICY "Family members can view diagnostic sessions"
ON public.diagnostic_sessions FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

CREATE POLICY "Parents can insert diagnostic sessions"
ON public.diagnostic_sessions FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));

CREATE POLICY "Parents can update diagnostic sessions"
ON public.diagnostic_sessions FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

CREATE POLICY "Parents can delete diagnostic sessions"
ON public.diagnostic_sessions FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

CREATE POLICY "Family members can view diagnostic targets"
ON public.diagnostic_targets FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.diagnostic_sessions ds
        WHERE ds.id = session_id AND public.can_read_student(ds.student_id)
    )
);

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

CREATE POLICY "Family members can view learning evidence"
ON public.learning_evidence FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

CREATE POLICY "Parents can insert learning evidence"
ON public.learning_evidence FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));

CREATE POLICY "Parents can update learning evidence"
ON public.learning_evidence FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

CREATE POLICY "Parents can delete learning evidence"
ON public.learning_evidence FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

CREATE POLICY "Family members can view assessment attempts"
ON public.assessment_attempts FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

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

CREATE POLICY "Parents can update assessment attempts"
ON public.assessment_attempts FOR UPDATE
TO authenticated
USING (public.can_modify_student(student_id))
WITH CHECK (public.can_modify_student(student_id));

CREATE POLICY "Parents can delete assessment attempts"
ON public.assessment_attempts FOR DELETE
TO authenticated
USING (public.can_modify_student(student_id));

CREATE POLICY "Family members can view learning state history"
ON public.learning_state_history FOR SELECT
TO authenticated
USING (public.can_read_student(student_id));

CREATE POLICY "Parents can insert learning state history"
ON public.learning_state_history FOR INSERT
TO authenticated
WITH CHECK (public.can_modify_student(student_id));

-- =============================================================================
-- 16. PHASE 2B.1 HARDENING: TRIGGERS & AUDIT IMMUTABILITY
-- =============================================================================

-- 1. Diagnostic target must have at least one curriculum entity
ALTER TABLE public.diagnostic_targets
DROP CONSTRAINT IF EXISTS chk_diag_target_has_entity;

ALTER TABLE public.diagnostic_targets
ADD CONSTRAINT chk_diag_target_has_entity
CHECK (learning_objective_id IS NOT NULL OR concept_id IS NOT NULL);

-- 2. Protect learning state history from update/deletion
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

-- 3. Assessment attempts semantic cross-validation trigger
CREATE OR REPLACE FUNCTION public.check_assessment_attempt_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Student identity check for authenticated students
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.can_modify_student(NEW.student_id) THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.students s
                WHERE s.id = NEW.student_id AND s.profile_id = auth.uid()
            ) THEN
                RAISE EXCEPTION 'Students can only record assessment attempts for their own profile.';
            END IF;
        END IF;
    END IF;

    -- Diagnostic session must belong to the same student
    IF NEW.diagnostic_session_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.diagnostic_sessions ds
            WHERE ds.id = NEW.diagnostic_session_id AND ds.student_id = NEW.student_id
        ) THEN
            RAISE EXCEPTION 'Diagnostic session % does not belong to student %',
                NEW.diagnostic_session_id, NEW.student_id;
        END IF;
    END IF;

    -- Evidence must belong to the same student and learning objective
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

    -- Assessment item, if supplied, must correspond to the learning objective
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

-- 4. Diagnostic session semantic validation trigger
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

-- 5. Atomic state + history parent override RPC
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
    IF NOT public.can_modify_student(p_student_id) THEN
        RAISE EXCEPTION 'Access denied: caller is not an authorized parent for student %', p_student_id;
    END IF;

    IF p_new_mastery_state NOT IN ('NOT_ASSESSED', 'EMERGING', 'DEVELOPING', 'SECURE', 'MASTERED') THEN
        RAISE EXCEPTION 'Invalid mastery_state: %', p_new_mastery_state;
    END IF;

    IF p_new_gap_status NOT IN ('NO_DATA', 'ON_TRACK', 'DEVELOPING', 'GAP', 'PREREQUISITE_GAP') THEN
        RAISE EXCEPTION 'Invalid gap_status: %', p_new_gap_status;
    END IF;

    IF p_confidence_level NOT IN ('LOW', 'MEDIUM', 'HIGH') THEN
        RAISE EXCEPTION 'Invalid confidence_level: %', p_confidence_level;
    END IF;

    SELECT id, mastery_state, gap_status, evidence_count, last_demonstrated_at
    INTO v_existing_state_id, v_prev_mastery, v_prev_gap, v_prev_evidence_count, v_existing_last_demonstrated
    FROM public.student_learning_states
    WHERE student_id = p_student_id
      AND learning_objective_id = p_learning_objective_id;

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

    INSERT INTO public.learning_evidence (
        id, student_id, learning_objective_id, evidence_type, support_level,
        result_status, reliability, source_reference, captured_at, notes, created_at
    ) VALUES (
        v_evidence_id, p_student_id, p_learning_objective_id, 'PARENT_OVERRIDE', 'INDEPENDENT',
        v_result_status, p_confidence_level, 'Parent Administrative Assessment', v_now, TRIM(p_notes), v_now
    ) RETURNING * INTO v_inserted_evidence;

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

-- Phase 2C.2 Atomic Diagnostic Session & Target Creation
CREATE OR REPLACE FUNCTION public.create_diagnostic_session_with_targets(
    p_student_id UUID,
    p_student_subject_id UUID,
    p_specification_id UUID,
    p_title TEXT,
    p_purpose TEXT,
    p_targets JSONB
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

-- Phase 2C.3 Server-Authoritative Response Submission & Learning State Transaction
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



