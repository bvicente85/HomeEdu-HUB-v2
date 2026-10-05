/**
 * Curriculum Knowledge Base Architecture Types (Phase 2A)
 * Represents the English educational hierarchy, qualifications, specifications,
 * topics, atomic concepts, learning objectives, and rigorous provenance metadata.
 *
 * NOTE: Student learning state (mastery, confidence, progress) and learning activities
 * are strictly decoupled from this knowledge base and belong to future models.
 */

export type VerificationStatus =
  | 'VERIFIED_OFFICIAL'
  | 'SECONDARY_SOURCE'
  | 'DERIVED'
  | 'UNVERIFIED';

export type TierEligibility = 'Foundation' | 'Higher' | 'Both' | 'Not applicable';

export type PrivateCandidateSuitability =
  | 'HIGHLY_ACCESSIBLE'
  | 'ACCESSIBLE_WITH_ARRANGEMENTS'
  | 'RESTRICTED_NEA'
  | 'UNAVAILABLE';

export type PrerequisiteType =
  | 'STRICT_PREREQUISITE'
  | 'RECOMMENDED_CO_REQUISITE'
  | 'DEVELOPMENTAL_EXTENSION';

export type AssessmentItemType =
  | 'MULTIPLE_CHOICE'
  | 'SHORT_PROCEDURAL'
  | 'STRUCTURED_MULTI_STEP'
  | 'EXTENDED_REASONING'
  | 'INVESTIGATIVE_PRACTICAL';

export interface CurriculumSource {
  id: string;
  source_code: string;
  title: string;
  publisher: string;
  source_type: string;
  url?: string;
  publication_date?: string;
  retrieved_date?: string;
  version?: string;
  jurisdiction: string;
  verification_status: VerificationStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CurriculumFramework {
  id: string;
  code: string;
  name: string;
  jurisdiction: string;
  governing_body: string;
  description?: string;
  is_statutory_for_maintained_schools: boolean;
  is_mandatory_for_ehe: boolean;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface EducationStage {
  id: string;
  framework_id: string;
  code: string;
  name: string;
  typical_age_start: number;
  typical_age_end: number;
  year_groups: string[];
  description?: string;
  assessment_model: string;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface CurriculumSubject {
  id: string;
  code: string;
  name: string;
  classification: 'Core' | 'Foundation' | 'Entitlement' | 'Optional';
  description?: string;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface Qualification {
  id: string;
  code: string;
  title: string;
  level: string;
  grading_scale: string;
  is_linear: boolean;
  has_tiering: boolean;
  default_glh_min?: number;
  default_glh_max?: number;
  default_tqt_min?: number;
  default_tqt_max?: number;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface ExamBoard {
  id: string;
  code: string;
  name: string;
  regulatory_status: string;
  website_url?: string;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface RegulatoryAuthority {
  id: string;
  code: string;
  name: string;
  authority_type: 'MINISTERIAL_DEPARTMENT' | 'INDEPENDENT_REGULATOR' | 'STATUTORY_AGENCY';
  jurisdiction: string;
  website_url?: string;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export type ProgrammeType =
  | 'QUALIFICATION_SPECIFICATION'
  | 'NATIONAL_CURRICULUM_PROGRAMME';

export type CoverageStatus =
  | 'PARTIAL_VERTICAL_SLICE'
  | 'STRUCTURAL_ONLY'
  | 'COMPLETE'
  | 'REQUIRES_VERIFICATION';

export interface AssessmentStructure {
  papers_count: number;
  total_marks: number;
  paper_details: {
    paper_number: number;
    title: string;
    marks: number;
    duration_minutes: number;
    calculator_allowed: boolean;
    weighting_percentage: number;
  }[];
  common_marks_min_percentage?: number;
}

export interface Specification {
  id: string;
  programme_type: ProgrammeType;
  subject_id: string;
  qualification_id?: string | null;
  exam_board_id?: string | null;
  authority_id?: string | null;
  framework_id?: string | null;
  stage_id: string;
  specification_code: string;
  title: string;
  version: string;
  is_current: boolean;
  effective_from?: string;
  effective_to?: string;
  regulatory_conditions_source_id?: string | null;
  regulatory_conditions_reference?: string;
  current_status_verified_date?: string;
  current_status_provenance?: string;
  accreditation_number?: string;
  has_tiers: boolean;
  tiers_supported: string[];
  glh?: number;
  tqt?: number;
  assessment_structure?: AssessmentStructure;
  private_candidate_suitability: PrivateCandidateSuitability;
  coverage_status: CoverageStatus;
  notes?: string;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface AssessmentObjective {
  id: string;
  specification_id: string;
  qualification_id?: string;
  code: string;
  title: string;
  description: string;
  weighting_foundation?: number;
  weighting_higher?: number;
  weighting_untiered?: number;
  tolerance?: number;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface CurriculumTopic {
  id: string;
  specification_id: string;
  parent_topic_id?: string | null;
  code?: string;
  title: string;
  tier_eligibility: TierEligibility;
  sort_order: number;
  external_reference?: string;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface Concept {
  id: string;
  topic_id: string;
  code: string;
  title: string;
  description?: string;
  tier_eligibility: TierEligibility;
  cognitive_domain?: string;
  estimated_guided_hours?: number;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface LearningObjective {
  id: string;
  concept_id: string;
  code: string;
  statement: string;
  primary_ao_id?: string;
  tier_eligibility: TierEligibility;
  target_grade_min?: number;
  target_grade_max?: number;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface PrerequisiteRelationship {
  id: string;
  concept_id: string;
  prerequisite_concept_id: string;
  relationship_type: PrerequisiteType;
  justification?: string;
  source_id?: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface AssessmentItem {
  id: string;
  specification_id: string;
  topic_id?: string;
  concept_id?: string;
  learning_objective_id?: string;
  primary_ao_id?: string;
  item_reference: string;
  tier: 'Foundation' | 'Higher' | 'Common' | 'Untiered';
  calculator_allowed: boolean;
  total_marks: number;
  item_type: AssessmentItemType;
  target_grade_band?: string;
  is_common_targeted_question: boolean;
  source_id?: string;
  verification_status: VerificationStatus;
  notes?: string;
  content?: AssessmentItemContent[];
  created_at: string;
  updated_at: string;
}

export type AssessmentContentFormat = 'MULTIPLE_CHOICE' | 'SHORT_NUMERIC' | 'EXACT_EXPRESSION';

export type AssessmentSourceType = 'ORIGINAL_HOMEEDU' | 'OFFICIAL_SOURCE' | 'OPEN_LICENSED' | 'DERIVED_ADAPTATION';

export interface AssessmentOption {
  id: string;
  text: string;
  distractor_rationale?: string;
}

export interface AssessmentItemContent {
  id: string;
  assessment_item_id: string;
  version: string;
  content_format: AssessmentContentFormat;
  prompt: string;
  options?: AssessmentOption[] | null;
  canonical_answer: string;
  answer_tolerance?: number | null;
  answer_unit?: string | null;
  equivalent_representations?: string[] | null;
  source_type: AssessmentSourceType;
  verification_status: VerificationStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Complete Specification Hierarchy Representation for Curriculum Browsing
 */
export interface SpecificationDetail extends Specification {
  subject?: CurriculumSubject;
  qualification?: Qualification | null;
  exam_board?: ExamBoard | null;
  authority?: RegulatoryAuthority | null;
  framework?: CurriculumFramework | null;
  stage?: EducationStage;
  source?: CurriculumSource;
  regulatory_conditions_source?: CurriculumSource | null;
  assessment_objectives: AssessmentObjective[];
  topics: (CurriculumTopic & {
    concepts: (Concept & {
      learning_objectives: LearningObjective[];
      prerequisites: (PrerequisiteRelationship & {
        prerequisite_concept?: Concept;
      })[];
    })[];
  })[];
  assessment_items: AssessmentItem[];
}
