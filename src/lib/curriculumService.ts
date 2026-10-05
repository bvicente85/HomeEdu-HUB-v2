/**
 * Curriculum Service (Phase 2A)
 * Provides read access to the Curriculum Knowledge Base with full provenance tracing.
 * Operates against live Supabase PostgreSQL tables when configured, with verified
 * local seed data matching the English Educational Framework Deep Research.
 */

import {
  CurriculumFramework,
  CurriculumSource,
  CurriculumSubject,
  EducationStage,
  ExamBoard,
  Qualification,
  RegulatoryAuthority,
  Specification,
  SpecificationDetail,
} from '../types/curriculum';
import { getSupabaseClient, isSupabaseConfigured, isSupabaseReachable, markSupabaseConnectivityFailed } from './supabase';

// =============================================================================
// VERIFIED REFERENCE SEED DATA (FROM DEEP RESEARCH)
// =============================================================================

export const REFERENCE_SOURCES: CurriculumSource[] = [
  {
    id: '00000001-0000-0000-0000-000000000001',
    source_code: 'OFQUAL_GCSE_MATHS_CONDITIONS_2022',
    title: 'GCSE (9 to 1) Subject-Level Conditions and Requirements for Mathematics',
    publisher: 'Ofqual',
    source_type: 'OFFICIAL_REGULATION',
    url: 'https://www.gov.uk/government/publications/gcse-9-to-1-subject-level-conditions-and-requirements-for-mathematics',
    publication_date: '2022-04-01',
    retrieved_date: '2026-10-04',
    version: 'Ofqual/16/6127',
    jurisdiction: 'England',
    verification_status: 'VERIFIED_OFFICIAL',
    notes: 'Statutory regulation defining mandatory AO weightings (AO1 50%/40%, AO2 25%/30%, AO3 25%/30%) and tiering boundaries.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000001-0000-0000-0000-000000000002',
    source_code: 'PEARSON_EDEXCEL_1MA1_SPEC_2015',
    title: 'Pearson Edexcel Level 1/Level 2 GCSE (9-1) in Mathematics (1MA1) Specification',
    publisher: 'Pearson Edexcel',
    source_type: 'QUALIFICATION_SPECIFICATION',
    url: 'https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/specification-and-sample-assesment/gcse-maths-2015-specification.pdf',
    publication_date: '2015-01-01',
    retrieved_date: '2026-10-04',
    version: 'Issue 2',
    jurisdiction: 'England',
    verification_status: 'VERIFIED_OFFICIAL',
    notes: 'Accredited terminal examination specification for GCSE Mathematics. 3 papers of 80 marks each (1 non-calc + 2 calc).',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000001-0000-0000-0000-000000000003',
    source_code: 'DFE_NAT_CURR_KS3_MATHS_2014',
    title: 'National Curriculum in England: Secondary Curriculum - Key Stage 3 Mathematics',
    publisher: 'Department for Education (DfE)',
    source_type: 'STATUTORY_CURRICULUM',
    url: 'https://www.gov.uk/government/publications/national-curriculum-in-england-secondary-curriculum',
    publication_date: '2014-09-01',
    retrieved_date: '2026-10-04',
    version: 'DFE-00179-2013',
    jurisdiction: 'England',
    verification_status: 'VERIFIED_OFFICIAL',
    notes: 'Statutory programmes of study for maintained schools. Non-statutory guidance for Elective Home Education (EHE).',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000001-0000-0000-0000-000000000004',
    source_code: 'EDUCATION_ACT_1996_SEC_7',
    title: 'Education Act 1996: Section 7 - Duty of parents to secure education of children',
    publisher: 'UK Parliament / The National Archives',
    source_type: 'OFFICIAL_REGULATION',
    url: 'https://www.legislation.gov.uk/ukpga/1996/56/section/7',
    publication_date: '1996-07-24',
    retrieved_date: '2026-10-04',
    version: '1996 c. 56',
    jurisdiction: 'England',
    verification_status: 'VERIFIED_OFFICIAL',
    notes: 'Establishes legal right to home education ("or otherwise") without duty to follow the National Curriculum.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_AUTHORITIES: RegulatoryAuthority[] = [
  {
    id: '00000006-0000-0000-0000-000000000005',
    code: 'DFE',
    name: 'Department for Education (DfE)',
    authority_type: 'MINISTERIAL_DEPARTMENT',
    jurisdiction: 'England',
    website_url: 'https://www.gov.uk/government/organisations/department-for-education',
    source_id: '00000001-0000-0000-0000-000000000003',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000006-0000-0000-0000-000000000006',
    code: 'OFQUAL',
    name: 'Office of Qualifications and Examinations Regulation (Ofqual)',
    authority_type: 'INDEPENDENT_REGULATOR',
    jurisdiction: 'England',
    website_url: 'https://www.gov.uk/government/organisations/ofqual',
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_FRAMEWORKS: CurriculumFramework[] = [
  {
    id: '00000002-0000-0000-0000-000000000001',
    code: 'ENG_NATIONAL_CURRICULUM',
    name: 'National Curriculum for England',
    jurisdiction: 'England',
    governing_body: 'Department for Education (DfE)',
    description: 'Statutory framework for maintained local authority schools. Academies are exempt from detailed programmes of study; EHE parents have no legal obligation to follow it.',
    is_statutory_for_maintained_schools: true,
    is_mandatory_for_ehe: false,
    source_id: '00000001-0000-0000-0000-000000000004',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000002-0000-0000-0000-000000000002',
    code: 'RQF_ENGLAND',
    name: 'Regulated Qualifications Framework (RQF)',
    jurisdiction: 'England',
    governing_body: 'Ofqual',
    description: 'National framework indexing regulated public qualifications from Entry Level through Level 8.',
    is_statutory_for_maintained_schools: true,
    is_mandatory_for_ehe: false,
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_STAGES: EducationStage[] = [
  {
    id: '00000003-0000-0000-0000-000000000001',
    framework_id: '00000002-0000-0000-0000-000000000001',
    code: 'KS3',
    name: 'Key Stage 3',
    typical_age_start: 11,
    typical_age_end: 14,
    year_groups: ['Year 7', 'Year 8', 'Year 9'],
    description: 'Lower secondary education. National numeric levels were abolished in 2014; schools and EHE employ assessment without levels.',
    assessment_model: 'Decentralised assessment without national levels (competency & mastery progression)',
    source_id: '00000001-0000-0000-0000-000000000003',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000003-0000-0000-0000-000000000002',
    framework_id: '00000002-0000-0000-0000-000000000002',
    code: 'KS4_GCSE',
    name: 'Key Stage 4 / GCSE',
    typical_age_start: 14,
    typical_age_end: 16,
    year_groups: ['Year 10', 'Year 11'],
    description: 'Upper secondary qualification pathway leading to terminal General Certificate of Secondary Education examinations.',
    assessment_model: 'Linear terminal examinations on 9 to 1 numerical scale (Ofqual Comparable Outcomes standard)',
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_SUBJECTS: CurriculumSubject[] = [
  {
    id: '00000004-0000-0000-0000-000000000001',
    code: 'MATHS',
    name: 'Mathematics',
    classification: 'Core',
    description: 'Mathematical reasoning, fluency, problem solving, algebra, geometry, probability, and statistics.',
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_QUALIFICATIONS: Qualification[] = [
  {
    id: '00000005-0000-0000-0000-000000000001',
    code: 'GCSE_9_1',
    title: 'General Certificate of Secondary Education (9 to 1)',
    level: 'Level 1 / Level 2 (RQF)',
    grading_scale: '9 to 1 numerical scale (9 highest, 1 lowest pass, U unclassified)',
    is_linear: true,
    has_tiering: true,
    default_glh_min: 120,
    default_glh_max: 140,
    default_tqt_min: 140,
    default_tqt_max: 150,
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_EXAM_BOARDS: ExamBoard[] = [
  {
    id: '00000006-0000-0000-0000-000000000001',
    code: 'PEARSON_EDEXCEL',
    name: 'Pearson Edexcel',
    regulatory_status: 'Ofqual Recognised Awarding Organisation',
    website_url: 'https://qualifications.pearson.com',
    source_id: '00000001-0000-0000-0000-000000000002',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000006-0000-0000-0000-000000000002',
    code: 'AQA',
    name: 'Assessment and Qualifications Alliance (AQA)',
    regulatory_status: 'Ofqual Recognised Awarding Organisation',
    website_url: 'https://www.aqa.org.uk',
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000006-0000-0000-0000-000000000003',
    code: 'OCR',
    name: 'Oxford, Cambridge and RSA (OCR)',
    regulatory_status: 'Ofqual Recognised Awarding Organisation',
    website_url: 'https://www.ocr.org.uk',
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000006-0000-0000-0000-000000000004',
    code: 'EDUQAS',
    name: 'WJEC Eduqas',
    regulatory_status: 'Ofqual Recognised Awarding Organisation',
    website_url: 'https://www.eduqas.co.uk',
    source_id: '00000001-0000-0000-0000-000000000001',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_SPECIFICATIONS: Specification[] = [
  {
    id: '00000007-0000-0000-0000-000000000001',
    programme_type: 'QUALIFICATION_SPECIFICATION',
    subject_id: '00000004-0000-0000-0000-000000000001',
    qualification_id: '00000005-0000-0000-0000-000000000001',
    exam_board_id: '00000006-0000-0000-0000-000000000001',
    authority_id: null,
    framework_id: '00000002-0000-0000-0000-000000000002',
    stage_id: '00000003-0000-0000-0000-000000000002',
    specification_code: '1MA1',
    title: 'Pearson Edexcel Level 1/Level 2 GCSE (9-1) in Mathematics (1MA1)',
    version: 'Issue 2',
    is_current: true,
    effective_from: '2015-09-01',
    regulatory_conditions_source_id: '00000001-0000-0000-0000-000000000001',
    regulatory_conditions_reference: 'Ofqual/16/6127: GCSE (9 to 1) Subject-Level Conditions and Requirements for Mathematics',
    current_status_verified_date: '2026-10-04',
    current_status_provenance: 'Verified active for current terminal GCSE examination cohorts against Ofqual Register of Regulated Qualifications and Pearson Qualifications official specification portal.',
    accreditation_number: '601/4700/3',
    has_tiers: true,
    tiers_supported: ['Foundation', 'Higher'],
    glh: 130,
    tqt: 140,
    assessment_structure: {
      papers_count: 3,
      total_marks: 240,
      common_marks_min_percentage: 20,
      paper_details: [
        { paper_number: 1, title: 'Paper 1 (Non-Calculator)', marks: 80, duration_minutes: 90, calculator_allowed: false, weighting_percentage: 33.33 },
        { paper_number: 2, title: 'Paper 2 (Calculator)', marks: 80, duration_minutes: 90, calculator_allowed: true, weighting_percentage: 33.33 },
        { paper_number: 3, title: 'Paper 3 (Calculator)', marks: 80, duration_minutes: 90, calculator_allowed: true, weighting_percentage: 33.33 },
      ],
    },
    private_candidate_suitability: 'HIGHLY_ACCESSIBLE',
    coverage_status: 'PARTIAL_VERTICAL_SLICE',
    notes: 'Architectural Partial Vertical Slice: Contains 6 verified concepts and learning objectives to validate relational hierarchy, tiering restrictions, and prerequisite logic. This does NOT represent the complete Pearson Edexcel GCSE (9-1) Mathematics specification.',
    source_id: '00000001-0000-0000-0000-000000000002',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000007-0000-0000-0000-000000000002',
    programme_type: 'NATIONAL_CURRICULUM_PROGRAMME',
    subject_id: '00000004-0000-0000-0000-000000000001',
    qualification_id: null,
    exam_board_id: null,
    authority_id: '00000006-0000-0000-0000-000000000005', // DfE
    framework_id: '00000002-0000-0000-0000-000000000001', // National Curriculum for England
    stage_id: '00000003-0000-0000-0000-000000000001', // KS3
    specification_code: 'DFE-KS3-MATHS',
    title: 'National Curriculum: Mathematics Programme of Study (Key Stage 3)',
    version: '2014 Framework',
    is_current: true,
    effective_from: '2014-09-01',
    regulatory_conditions_source_id: '00000001-0000-0000-0000-000000000003',
    regulatory_conditions_reference: 'Education Act 2002 Section 84: National Curriculum in England: Secondary Curriculum (DFE-00179-2013)',
    current_status_verified_date: '2026-10-04',
    current_status_provenance: 'Verified active statutory instrument for maintained schools; non-statutory reference standard for Elective Home Education.',
    accreditation_number: 'DFE-00179-2013',
    has_tiers: false,
    tiers_supported: ['Not applicable'],
    assessment_structure: {
      papers_count: 0,
      total_marks: 0,
      paper_details: [],
    },
    private_candidate_suitability: 'HIGHLY_ACCESSIBLE',
    coverage_status: 'STRUCTURAL_ONLY',
    notes: 'Statutory Programme of Study for maintained schools in England (Key Stage 3 Mathematics). Established under Section 84 of the Education Act 2002. Not an exam-board specification or qualification.',
    source_id: '00000001-0000-0000-0000-000000000003',
    verification_status: 'VERIFIED_OFFICIAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const REFERENCE_DETAILED_1MA1: SpecificationDetail = {
  ...REFERENCE_SPECIFICATIONS[0],
  subject: REFERENCE_SUBJECTS[0],
  qualification: REFERENCE_QUALIFICATIONS[0],
  exam_board: REFERENCE_EXAM_BOARDS[0],
  authority: null,
  framework: REFERENCE_FRAMEWORKS[1],
  stage: REFERENCE_STAGES[1],
  source: REFERENCE_SOURCES[1],
  regulatory_conditions_source: REFERENCE_SOURCES[0],
  assessment_objectives: [
    {
      id: '00000008-0000-0000-0000-000000000001',
      specification_id: '00000007-0000-0000-0000-000000000001',
      qualification_id: '00000005-0000-0000-0000-000000000001',
      code: 'AO1',
      title: 'Use and apply standard techniques',
      description: 'Learners should be able to accurately recall facts, terminology and definitions; use and apply routine mathematical procedures and algorithms without prompting.',
      weighting_foundation: 50.00,
      weighting_higher: 40.00,
      source_id: '00000001-0000-0000-0000-000000000001',
      verification_status: 'VERIFIED_OFFICIAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000008-0000-0000-0000-000000000002',
      specification_id: '00000007-0000-0000-0000-000000000001',
      qualification_id: '00000005-0000-0000-0000-000000000001',
      code: 'AO2',
      title: 'Reason, interpret and communicate mathematically',
      description: 'Learners should be able to make inferences and deductions; construct chains of mathematical reasoning and arguments; interpret and evaluate solutions and geometric/algebraic proofs.',
      weighting_foundation: 25.00,
      weighting_higher: 30.00,
      source_id: '00000001-0000-0000-0000-000000000001',
      verification_status: 'VERIFIED_OFFICIAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000008-0000-0000-0000-000000000003',
      specification_id: '00000007-0000-0000-0000-000000000001',
      qualification_id: '00000005-0000-0000-0000-000000000001',
      code: 'AO3',
      title: 'Solve problems within mathematics and in other contexts',
      description: 'Learners should be able to translate non-routine problems in mathematical or other contexts into a process or series of mathematical processes; make and evaluate multi-step plans.',
      weighting_foundation: 25.00,
      weighting_higher: 30.00,
      source_id: '00000001-0000-0000-0000-000000000001',
      verification_status: 'VERIFIED_OFFICIAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  topics: [
    {
      id: '00000009-0000-0000-0000-000000000002',
      specification_id: '00000007-0000-0000-0000-000000000001',
      code: 'A',
      title: 'Algebra',
      tier_eligibility: 'Both',
      sort_order: 20,
      external_reference: '1MA1 Section 2',
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      concepts: [
        {
          id: '00000010-0000-0000-0000-000000000001',
          topic_id: '00000009-0000-0000-0000-000000000002',
          code: 'EDX-MATH-ALG-LIN-01',
          title: 'Solving Linear Equations in One Unknown',
          description: 'Solving linear equations with variables on one or both sides, including those involving brackets and simple fractional terms.',
          tier_eligibility: 'Both',
          cognitive_domain: 'Algebraic Manipulation',
          estimated_guided_hours: 4.0,
          source_id: '00000001-0000-0000-0000-000000000002',
          verification_status: 'VERIFIED_OFFICIAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          learning_objectives: [
            {
              id: '00000011-0000-0000-0000-000000000001',
              concept_id: '00000010-0000-0000-0000-000000000001',
              code: 'LO-EDX-ALG-LIN-01',
              statement: 'Solve linear equations algebraically, including with unknowns on both sides and with fractional expressions.',
              primary_ao_id: '00000008-0000-0000-0000-000000000001',
              tier_eligibility: 'Both',
              target_grade_min: 3,
              target_grade_max: 5,
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          prerequisites: [],
        },
        {
          id: '00000010-0000-0000-0000-000000000002',
          topic_id: '00000009-0000-0000-0000-000000000002',
          code: 'EDX-MATH-ALG-QUAD-01',
          title: 'Solving Quadratic Equations Algebraically',
          description: 'Factorising quadratic expressions into two linear brackets, using the quadratic formula, and completing the square for Higher tier.',
          tier_eligibility: 'Both',
          cognitive_domain: 'Algebraic Manipulation',
          estimated_guided_hours: 6.0,
          source_id: '00000001-0000-0000-0000-000000000002',
          verification_status: 'VERIFIED_OFFICIAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          learning_objectives: [
            {
              id: '00000011-0000-0000-0000-000000000002',
              concept_id: '00000010-0000-0000-0000-000000000002',
              code: 'LO-EDX-ALG-QUAD-01',
              statement: 'Solve quadratic equations of the form ax^2 + bx + c = 0 algebraically by factorisation.',
              primary_ao_id: '00000008-0000-0000-0000-000000000001',
              tier_eligibility: 'Both',
              target_grade_min: 4,
              target_grade_max: 6,
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          prerequisites: [
            {
              id: '00000012-0000-0000-0000-000000000001',
              concept_id: '00000010-0000-0000-0000-000000000002',
              prerequisite_concept_id: '00000010-0000-0000-0000-000000000001',
              relationship_type: 'STRICT_PREREQUISITE',
              justification: 'Algebraic manipulation of linear equations and null-factor law are mathematically essential prior to solving quadratics.',
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      ],
    },
    {
      id: '00000009-0000-0000-0000-000000000004',
      specification_id: '00000007-0000-0000-0000-000000000001',
      code: 'G',
      title: 'Geometry and Measures',
      tier_eligibility: 'Both',
      sort_order: 40,
      external_reference: '1MA1 Section 4',
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      concepts: [
        {
          id: '00000010-0000-0000-0000-000000000003',
          topic_id: '00000009-0000-0000-0000-000000000004',
          code: 'EDX-MATH-GEO-VEC-01',
          title: 'Vector Arithmetic and Geometric Proofs',
          description: 'Representing vectors column-wise, performing vector addition/scalar multiplication, and constructing formal geometric vector proofs. Higher tier only.',
          tier_eligibility: 'Higher',
          cognitive_domain: 'Geometric Reasoning',
          estimated_guided_hours: 5.0,
          source_id: '00000001-0000-0000-0000-000000000002',
          verification_status: 'VERIFIED_OFFICIAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          learning_objectives: [
            {
              id: '00000011-0000-0000-0000-000000000003',
              concept_id: '00000010-0000-0000-0000-000000000003',
              code: 'LO-EDX-GEO-VEC-01',
              statement: 'Use vectors to construct geometric proofs involving collinear points, parallel vectors, and ratios.',
              primary_ao_id: '00000008-0000-0000-0000-000000000002',
              tier_eligibility: 'Higher',
              target_grade_min: 7,
              target_grade_max: 9,
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          prerequisites: [],
        },
        {
          id: '00000010-0000-0000-0000-000000000004',
          topic_id: '00000009-0000-0000-0000-000000000004',
          code: 'EDX-MATH-GEO-CIRC-01',
          title: 'Circle Theorems and Formal Angle Deductions',
          description: 'Applying circle theorems (angles in same segment, angle at centre is twice angle at circumference, alternate segment theorem) to deduce proofs. Higher tier only.',
          tier_eligibility: 'Higher',
          cognitive_domain: 'Geometric Reasoning',
          estimated_guided_hours: 6.0,
          source_id: '00000001-0000-0000-0000-000000000002',
          verification_status: 'VERIFIED_OFFICIAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          learning_objectives: [
            {
              id: '00000011-0000-0000-0000-000000000004',
              concept_id: '00000010-0000-0000-0000-000000000004',
              code: 'LO-EDX-GEO-CIRC-01',
              statement: 'Apply circle theorems to deduce unknown angles and construct formal mathematical arguments.',
              primary_ao_id: '00000008-0000-0000-0000-000000000002',
              tier_eligibility: 'Higher',
              target_grade_min: 7,
              target_grade_max: 9,
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          prerequisites: [],
        },
      ],
    },
    {
      id: '00000009-0000-0000-0000-000000000005',
      specification_id: '00000007-0000-0000-0000-000000000001',
      code: 'P',
      title: 'Probability',
      tier_eligibility: 'Both',
      sort_order: 50,
      external_reference: '1MA1 Section 5',
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      concepts: [
        {
          id: '00000010-0000-0000-0000-000000000006',
          topic_id: '00000009-0000-0000-0000-000000000005',
          code: 'EDX-MATH-PROB-BASE-01',
          title: 'Theoretical Probability and Sample Space Diagrams',
          description: 'Calculating single and independent combined event probabilities using fractions, decimals, and sample space grids.',
          tier_eligibility: 'Both',
          cognitive_domain: 'Statistical Reasoning',
          estimated_guided_hours: 3.5,
          source_id: '00000001-0000-0000-0000-000000000002',
          verification_status: 'VERIFIED_OFFICIAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          learning_objectives: [
            {
              id: '00000011-0000-0000-0000-000000000006',
              concept_id: '00000010-0000-0000-0000-000000000006',
              code: 'LO-EDX-PROB-BASE-01',
              statement: 'Record and describe the outcomes of simple probability experiments using tables, frequency trees, and grids.',
              primary_ao_id: '00000008-0000-0000-0000-000000000001',
              tier_eligibility: 'Both',
              target_grade_min: 1,
              target_grade_max: 4,
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          prerequisites: [],
        },
        {
          id: '00000010-0000-0000-0000-000000000005',
          topic_id: '00000009-0000-0000-0000-000000000005',
          code: 'EDX-MATH-PROB-COND-01',
          title: 'Conditional Probability and Multi-Event Models',
          description: 'Determining conditional probabilities from Venn diagrams, two-way tables, and tree diagrams (without replacement). Higher tier only.',
          tier_eligibility: 'Higher',
          cognitive_domain: 'Statistical Reasoning',
          estimated_guided_hours: 4.5,
          source_id: '00000001-0000-0000-0000-000000000002',
          verification_status: 'VERIFIED_OFFICIAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          learning_objectives: [
            {
              id: '00000011-0000-0000-0000-000000000005',
              concept_id: '00000010-0000-0000-0000-000000000005',
              code: 'LO-EDX-PROB-COND-01',
              statement: 'Calculate and interpret conditional probabilities using tree diagrams without replacement and Venn diagrams.',
              primary_ao_id: '00000008-0000-0000-0000-000000000003',
              tier_eligibility: 'Higher',
              target_grade_min: 7,
              target_grade_max: 9,
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          prerequisites: [
            {
              id: '00000012-0000-0000-0000-000000000002',
              concept_id: '00000010-0000-0000-0000-000000000005',
              prerequisite_concept_id: '00000010-0000-0000-0000-000000000006',
              relationship_type: 'STRICT_PREREQUISITE',
              justification: 'Understanding sample spaces and mutually exclusive probability axioms is strictly required before conditional non-replacement calculation.',
              source_id: '00000001-0000-0000-0000-000000000002',
              verification_status: 'VERIFIED_OFFICIAL',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  ],
  assessment_items: [
    {
      id: '00000013-0000-0000-0000-000000000101',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000002',
      concept_id: '00000010-0000-0000-0000-000000000001',
      learning_objective_id: '00000011-0000-0000-0000-000000000001',
      primary_ao_id: '00000008-0000-0000-0000-000000000001',
      item_reference: 'DIAG-EDX-MATH-LIN-01',
      tier: 'Foundation',
      calculator_allowed: false,
      total_marks: 2,
      item_type: 'SHORT_PROCEDURAL',
      target_grade_band: 'Grade 2-3',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Two-step single variable linear equation test.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000101',
          assessment_item_id: '00000013-0000-0000-0000-000000000101',
          version: 'v1',
          content_format: 'SHORT_NUMERIC',
          prompt: 'Solve the linear equation for $x$:\n$$4x + 7 = 31$$',
          canonical_answer: '6',
          answer_tolerance: 0,
          equivalent_representations: ['6', 'x=6', 'x = 6'],
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Canonical answer is 6.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000102',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000002',
      concept_id: '00000010-0000-0000-0000-000000000001',
      learning_objective_id: '00000011-0000-0000-0000-000000000001',
      primary_ao_id: '00000008-0000-0000-0000-000000000001',
      item_reference: 'DIAG-EDX-MATH-LIN-02',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 3,
      item_type: 'SHORT_PROCEDURAL',
      target_grade_band: 'Grade 4-5',
      is_common_targeted_question: true,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Linear equation with unknowns on both sides.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000102',
          assessment_item_id: '00000013-0000-0000-0000-000000000102',
          version: 'v1',
          content_format: 'MULTIPLE_CHOICE',
          prompt: 'Solve the linear equation with unknowns on both sides:\n$$5x - 3 = 2x + 12$$',
          options: [
            { id: 'A', text: 'x = 5', distractor_rationale: 'Correct: 5x - 2x = 12 + 3 => 3x = 15 => x = 5' },
            { id: 'B', text: 'x = 3', distractor_rationale: 'Subtracted 3 from 12 instead of adding (3x = 9)' },
            { id: 'C', text: 'x = 15/7', distractor_rationale: 'Added 2x to 5x instead of subtracting (7x = 15)' },
            { id: 'D', text: 'x = 1.5', distractor_rationale: 'Sign error on both constant and variable terms' },
          ],
          canonical_answer: 'A',
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Multiple-choice diagnostic targeting linear transposition misconceptions.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000103',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000002',
      concept_id: '00000010-0000-0000-0000-000000000002',
      learning_objective_id: '00000011-0000-0000-0000-000000000002',
      primary_ao_id: '00000008-0000-0000-0000-000000000001',
      item_reference: 'DIAG-EDX-MATH-QUAD-01',
      tier: 'Common',
      calculator_allowed: false,
      total_marks: 3,
      item_type: 'STRUCTURED_MULTI_STEP',
      target_grade_band: 'Grade 4-5',
      is_common_targeted_question: true,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Quadratic factorisation monic polynomial.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000103',
          assessment_item_id: '00000013-0000-0000-0000-000000000103',
          version: 'v1',
          content_format: 'MULTIPLE_CHOICE',
          prompt: 'Solve the quadratic equation by factorisation:\n$$x^2 - 7x + 12 = 0$$',
          options: [
            { id: 'A', text: 'x = 3 or x = 4', distractor_rationale: 'Correct: (x-3)(x-4) = 0 => x = 3, 4' },
            { id: 'B', text: 'x = -3 or x = -4', distractor_rationale: 'Factor sign inversion: forgot to solve factor = 0' },
            { id: 'C', text: 'x = 2 or x = 6', distractor_rationale: 'Factors of 12 summing to 8 rather than 7' },
            { id: 'D', text: 'x = -1 or x = 12', distractor_rationale: 'Incorrect factor pairs' },
          ],
          canonical_answer: 'A',
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Tests root identification vs factor expression.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000104',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000002',
      concept_id: '00000010-0000-0000-0000-000000000002',
      learning_objective_id: '00000011-0000-0000-0000-000000000002',
      primary_ao_id: '00000008-0000-0000-0000-000000000001',
      item_reference: 'DIAG-EDX-MATH-QUAD-02',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 3,
      item_type: 'STRUCTURED_MULTI_STEP',
      target_grade_band: 'Grade 6-7',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Non-monic quadratic factorisation.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000104',
          assessment_item_id: '00000013-0000-0000-0000-000000000104',
          version: 'v1',
          content_format: 'MULTIPLE_CHOICE',
          prompt: 'Solve the quadratic equation where $a > 1$:\n$$2x^2 + 5x - 3 = 0$$',
          options: [
            { id: 'A', text: 'x = 1/2 or x = -3', distractor_rationale: 'Correct: (2x - 1)(x + 3) = 0 => x = 1/2, -3' },
            { id: 'B', text: 'x = -1/2 or x = 3', distractor_rationale: 'Root sign flip error' },
            { id: 'C', text: 'x = 1 or x = -3/2', distractor_rationale: 'Incorrect factor split (2x + 3)(x - 1)' },
            { id: 'D', text: 'x = 3/2 or x = -1', distractor_rationale: 'Incorrect constant distribution' },
          ],
          canonical_answer: 'A',
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Tests non-monic factoring.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000105',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000004',
      concept_id: '00000010-0000-0000-0000-000000000003',
      learning_objective_id: '00000011-0000-0000-0000-000000000003',
      primary_ao_id: '00000008-0000-0000-0000-000000000002',
      item_reference: 'DIAG-EDX-MATH-VEC-01',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 3,
      item_type: 'EXTENDED_REASONING',
      target_grade_band: 'Grade 7-8',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Vector collinearity and scalar multiples.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000105',
          assessment_item_id: '00000013-0000-0000-0000-000000000105',
          version: 'v1',
          content_format: 'MULTIPLE_CHOICE',
          prompt: 'Vector $\\mathbf{p} = 2\\mathbf{a} + 3\\mathbf{b}$ and vector $\\mathbf{q} = 6\\mathbf{a} + 9\\mathbf{b}$. Which statement correctly describes the geometric relationship between vectors $\\mathbf{p}$ and $\\mathbf{q}$?',
          options: [
            { id: 'A', text: 'q is parallel to p because q = 3p (scalar multiple)', distractor_rationale: 'Correct: q is 3 times p, proving parallel direction' },
            { id: 'B', text: 'q is perpendicular to p because their coefficients are in ratio 2:3', distractor_rationale: 'Confuses scalar multiple with perpendicularity' },
            { id: 'C', text: 'q and p have the same magnitude because they share a and b', distractor_rationale: 'Ignores the scalar factor 3 scaling magnitude' },
            { id: 'D', text: 'p and q are non-collinear basis vectors', distractor_rationale: 'Fails to recognise linear dependency' },
          ],
          canonical_answer: 'A',
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Collinearity and parallel vector test.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000106',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000004',
      concept_id: '00000010-0000-0000-0000-000000000003',
      learning_objective_id: '00000011-0000-0000-0000-000000000003',
      primary_ao_id: '00000008-0000-0000-0000-000000000002',
      item_reference: 'DIAG-EDX-MATH-VEC-02',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 2,
      item_type: 'SHORT_PROCEDURAL',
      target_grade_band: 'Grade 7-8',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Vector subtraction on a line segment.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000106',
          assessment_item_id: '00000013-0000-0000-0000-000000000106',
          version: 'v1',
          content_format: 'EXACT_EXPRESSION',
          prompt: 'If $\\vec{OA} = \\mathbf{a}$ and $\\vec{OB} = \\mathbf{b}$, express vector $\\vec{AB}$ in terms of $\\mathbf{a}$ and $\\mathbf{b}$.',
          canonical_answer: 'b - a',
          equivalent_representations: ['b - a', '-a + b', 'b-a', '-a+b'],
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Canonical expression is b - a.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000107',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000004',
      concept_id: '00000010-0000-0000-0000-000000000004',
      learning_objective_id: '00000011-0000-0000-0000-000000000004',
      primary_ao_id: '00000008-0000-0000-0000-000000000002',
      item_reference: 'DIAG-EDX-MATH-CIRC-01',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 2,
      item_type: 'SHORT_PROCEDURAL',
      target_grade_band: 'Grade 7-8',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Angle at centre is twice angle at circumference theorem.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000107',
          assessment_item_id: '00000013-0000-0000-0000-000000000107',
          version: 'v1',
          content_format: 'SHORT_NUMERIC',
          prompt: 'Points $A$, $B$, and $C$ lie on the circumference of a circle with centre $O$. Angle $\\angle AOC = 110^\\circ$. What is the size, in degrees, of angle $\\angle ABC$ subtended at the circumference by the same arc?',
          canonical_answer: '55',
          answer_tolerance: 0,
          answer_unit: 'degrees',
          equivalent_representations: ['55', '55 deg', '55°'],
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Angle at centre is twice angle at circumference => 110 / 2 = 55.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000108',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000004',
      concept_id: '00000010-0000-0000-0000-000000000004',
      learning_objective_id: '00000011-0000-0000-0000-000000000004',
      primary_ao_id: '00000008-0000-0000-0000-000000000002',
      item_reference: 'DIAG-EDX-MATH-CIRC-02',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 2,
      item_type: 'EXTENDED_REASONING',
      target_grade_band: 'Grade 7-8',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Cyclic quadrilateral angle sum theorem.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000108',
          assessment_item_id: '00000013-0000-0000-0000-000000000108',
          version: 'v1',
          content_format: 'MULTIPLE_CHOICE',
          prompt: 'A cyclic quadrilateral $ABCD$ is inscribed in a circle. Angle $\\angle DAB = 72^\\circ$. What is the size of the opposite angle $\\angle BCD$, and which circle theorem justifies it?',
          options: [
            { id: 'A', text: '108°, because opposite angles of a cyclic quadrilateral sum to 180°', distractor_rationale: 'Correct: 180 - 72 = 108' },
            { id: 'B', text: '72°, because angles in the same segment are equal', distractor_rationale: 'Confuses cyclic quadrilateral with same segment angles' },
            { id: 'C', text: '144°, because angle at centre is twice angle at circumference', distractor_rationale: 'Applies centre theorem to opposite quadrilateral vertex' },
            { id: 'D', text: '288°, because angles in a circle sum to 360°', distractor_rationale: 'Subtracted from 360 instead of 180' },
          ],
          canonical_answer: 'A',
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Cyclic quadrilateral theorem test.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000109',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000005',
      concept_id: '00000010-0000-0000-0000-000000000005',
      learning_objective_id: '00000011-0000-0000-0000-000000000005',
      primary_ao_id: '00000008-0000-0000-0000-000000000003',
      item_reference: 'DIAG-EDX-MATH-PROB-01',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 3,
      item_type: 'STRUCTURED_MULTI_STEP',
      target_grade_band: 'Grade 7-8',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Non-replacement probability compound events.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000109',
          assessment_item_id: '00000013-0000-0000-0000-000000000109',
          version: 'v1',
          content_format: 'MULTIPLE_CHOICE',
          prompt: 'A bag contains 5 red counters and 4 blue counters. A counter is taken at random and NOT replaced. A second counter is then taken at random. What is the probability that both counters are red?',
          options: [
            { id: 'A', text: '20/72 (or 5/18)', distractor_rationale: 'Correct: (5/9) * (4/8) = 20/72 = 5/18' },
            { id: 'B', text: '25/81', distractor_rationale: 'Assumed replacement: (5/9) * (5/9)' },
            { id: 'C', text: '9/17', distractor_rationale: 'Added numerators and denominators instead of multiplying' },
            { id: 'D', text: '4/9', distractor_rationale: 'Calculated only single-event probability' },
          ],
          canonical_answer: 'A',
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Tests without-replacement conditional logic.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000110',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000005',
      concept_id: '00000010-0000-0000-0000-000000000005',
      learning_objective_id: '00000011-0000-0000-0000-000000000005',
      primary_ao_id: '00000008-0000-0000-0000-000000000003',
      item_reference: 'DIAG-EDX-MATH-PROB-02',
      tier: 'Higher',
      calculator_allowed: false,
      total_marks: 3,
      item_type: 'STRUCTURED_MULTI_STEP',
      target_grade_band: 'Grade 7-8',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Conditional probability from Venn subsets.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000110',
          assessment_item_id: '00000013-0000-0000-0000-000000000110',
          version: 'v1',
          content_format: 'SHORT_NUMERIC',
          prompt: 'In a class of 30 students, 18 study French ($F$), 12 study German ($G$), and 6 study both. A student is selected at random from those who study French. What is the probability that this student also studies German? (Give decimal rounded to 4 d.p., e.g. 0.3333)',
          canonical_answer: '0.3333',
          answer_tolerance: 0.005,
          equivalent_representations: ['0.3333', '1/3', '6/18', '0.333'],
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'P(G|F) = 6 / 18 = 1/3 ≈ 0.3333.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000111',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000005',
      concept_id: '00000010-0000-0000-0000-000000000006',
      learning_objective_id: '00000011-0000-0000-0000-000000000006',
      primary_ao_id: '00000008-0000-0000-0000-000000000001',
      item_reference: 'DIAG-EDX-MATH-BASE-01',
      tier: 'Foundation',
      calculator_allowed: false,
      total_marks: 2,
      item_type: 'SHORT_PROCEDURAL',
      target_grade_band: 'Grade 1-3',
      is_common_targeted_question: false,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Simple single-event theoretical probability.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000111',
          assessment_item_id: '00000013-0000-0000-0000-000000000111',
          version: 'v1',
          content_format: 'SHORT_NUMERIC',
          prompt: 'A fair six-sided dice numbered 1 to 6 is rolled once. What is the probability of rolling an even prime number? (Give decimal rounded to 4 d.p., e.g. 0.1667)',
          canonical_answer: '0.1667',
          answer_tolerance: 0.005,
          equivalent_representations: ['0.1667', '1/6', '0.167'],
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Even prime is only 2 => 1/6 ≈ 0.1667.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000013-0000-0000-0000-000000000112',
      specification_id: '00000007-0000-0000-0000-000000000001',
      topic_id: '00000009-0000-0000-0000-000000000005',
      concept_id: '00000010-0000-0000-0000-000000000006',
      learning_objective_id: '00000011-0000-0000-0000-000000000006',
      primary_ao_id: '00000008-0000-0000-0000-000000000001',
      item_reference: 'DIAG-EDX-MATH-BASE-02',
      tier: 'Common',
      calculator_allowed: false,
      total_marks: 2,
      item_type: 'STRUCTURED_MULTI_STEP',
      target_grade_band: 'Grade 3-4',
      is_common_targeted_question: true,
      source_id: '00000001-0000-0000-0000-000000000002',
      verification_status: 'VERIFIED_OFFICIAL',
      notes: 'Sample space grid for two independent spinners.',
      content: [
        {
          id: '00000014-0000-0000-0000-000000000112',
          assessment_item_id: '00000013-0000-0000-0000-000000000112',
          version: 'v1',
          content_format: 'MULTIPLE_CHOICE',
          prompt: 'Two fair spinners are spun. Spinner A has numbers 1, 2, 3. Spinner B has numbers 1, 2, 3, 4. The scores are added together. How many total outcomes are in the sample space, and what is the probability of getting a total score of 5?',
          options: [
            { id: 'A', text: '12 total outcomes; probability = 3/12 (or 1/4)', distractor_rationale: 'Correct: 3 * 4 = 12 total outcomes, pairs giving 5 are (1,4), (2,3), (3,2)' },
            { id: 'B', text: '7 total outcomes; probability = 1/7', distractor_rationale: 'Added outcome counts (3 + 4 = 7) instead of multiplying' },
            { id: 'C', text: '12 total outcomes; probability = 2/12', distractor_rationale: 'Missed one of the permutations for sum 5' },
            { id: 'D', text: '24 total outcomes; probability = 6/24', distractor_rationale: 'Double counted sample space' },
          ],
          canonical_answer: 'A',
          source_type: 'ORIGINAL_HOMEEDU',
          verification_status: 'VERIFIED_OFFICIAL',
          notes: 'Two-event sample space grid diagnostic.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

// =============================================================================
// CURRICULUM SERVICE IMPLEMENTATION
// =============================================================================

export const curriculumService = {
  async getCurriculumSources(): Promise<CurriculumSource[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('curriculum_sources')
          .select('*')
          .order('source_code', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as CurriculumSource[];
        }
      } catch (err) {
        console.warn('getCurriculumSources network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }
    return REFERENCE_SOURCES;
  },

  async getCurriculumFrameworks(): Promise<CurriculumFramework[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('curriculum_frameworks')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as CurriculumFramework[];
        }
      } catch (err) {
        console.warn('getCurriculumFrameworks network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }
    return REFERENCE_FRAMEWORKS;
  },

  async getEducationStages(): Promise<EducationStage[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('education_stages')
          .select('*')
          .order('typical_age_start', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as EducationStage[];
        }
      } catch (err) {
        console.warn('getEducationStages network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }
    return REFERENCE_STAGES;
  },

  async getCurriculumSubjects(): Promise<CurriculumSubject[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('curriculum_subjects')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as CurriculumSubject[];
        }
      } catch (err) {
        console.warn('getCurriculumSubjects network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }
    return REFERENCE_SUBJECTS;
  },

  async getQualifications(): Promise<Qualification[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('qualifications')
          .select('*')
          .order('code', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as Qualification[];
        }
      } catch (err) {
        console.warn('getQualifications network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }
    return REFERENCE_QUALIFICATIONS;
  },

  async getExamBoards(): Promise<ExamBoard[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('exam_boards')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as ExamBoard[];
        }
      } catch (err) {
        console.warn('getExamBoards network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }
    return REFERENCE_EXAM_BOARDS;
  },

  async getRegulatoryAuthorities(): Promise<RegulatoryAuthority[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('regulatory_authorities')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as RegulatoryAuthority[];
        }
      } catch (err) {
        console.warn('getRegulatoryAuthorities network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }
    return REFERENCE_AUTHORITIES;
  },

  async getSpecifications(filter?: {
    subjectId?: string;
    stageId?: string;
    examBoardId?: string;
  }): Promise<Specification[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        let query = supabase.from('specifications').select('*').order('specification_code', { ascending: true });

        if (filter?.subjectId) query = query.eq('subject_id', filter.subjectId);
        if (filter?.stageId) query = query.eq('stage_id', filter.stageId);
        if (filter?.examBoardId) query = query.eq('exam_board_id', filter.examBoardId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as Specification[];
        }
      } catch (err) {
        console.warn('getSpecifications network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }

    let specs = REFERENCE_SPECIFICATIONS;
    if (filter?.subjectId) specs = specs.filter((s) => s.subject_id === filter.subjectId);
    if (filter?.stageId) specs = specs.filter((s) => s.stage_id === filter.stageId);
    if (filter?.examBoardId) specs = specs.filter((s) => s.exam_board_id === filter.examBoardId);
    return specs;
  },

  async getSpecificationDetail(specificationId: string): Promise<SpecificationDetail | null> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;

        // 1. Fetch base specification with relations
        const { data: specData, error: specError } = await supabase
          .from('specifications')
          .select(`
            *,
            subject:curriculum_subjects(*),
            qualification:qualifications(*),
            exam_board:exam_boards(*),
            authority:regulatory_authorities(*),
            framework:curriculum_frameworks(*),
            stage:education_stages(*),
            source:curriculum_sources(*)
          `)
          .eq('id', specificationId)
          .maybeSingle();

        if (!specError && specData) {
          // 2. Fetch AOs
          const { data: aos } = await supabase
            .from('assessment_objectives')
            .select('*')
            .eq('specification_id', specificationId)
            .order('code', { ascending: true });

          // 3. Fetch Topics
          const { data: topics } = await supabase
            .from('curriculum_topics')
            .select('*')
            .eq('specification_id', specificationId)
            .order('sort_order', { ascending: true });

          const topicIds = (topics || []).map((t) => t.id);

          // 4. Fetch Concepts
          let concepts: any[] = [];
          if (topicIds.length > 0) {
            const { data: cData } = await supabase
              .from('concepts')
              .select('*')
              .in('topic_id', topicIds)
              .order('code', { ascending: true });
            concepts = cData || [];
          }

          const conceptIds = concepts.map((c) => c.id);

          // 5. Fetch Learning Objectives & Prerequisites
          let learningObjectives: any[] = [];
          let prerequisites: any[] = [];
          if (conceptIds.length > 0) {
            const { data: loData } = await supabase
              .from('learning_objectives')
              .select('*')
              .in('concept_id', conceptIds)
              .order('code', { ascending: true });
            learningObjectives = loData || [];

            const { data: prereqData } = await supabase
              .from('prerequisite_relationships')
              .select('*')
              .in('concept_id', conceptIds);
            prerequisites = prereqData || [];
          }

          // 6. Fetch Assessment Items
          const { data: items } = await supabase
            .from('assessment_items')
            .select('*')
            .eq('specification_id', specificationId)
            .order('item_reference', { ascending: true });

          // Assemble nested hierarchy
          const nestedTopics = (topics || []).map((t) => ({
            ...t,
            concepts: concepts
              .filter((c) => c.topic_id === t.id)
              .map((c) => ({
                ...c,
                learning_objectives: learningObjectives.filter((lo) => lo.concept_id === c.id),
                prerequisites: prerequisites.filter((p) => p.concept_id === c.id),
              })),
          }));

          return {
            ...specData,
            assessment_objectives: aos || [],
            topics: nestedTopics,
            assessment_items: items || [],
          } as SpecificationDetail;
        }
      } catch (err) {
        console.warn('getSpecificationDetail network notice:', err);
        markSupabaseConnectivityFailed(true);
      }
    }

    if (specificationId === REFERENCE_DETAILED_1MA1.id || specificationId === '1MA1') {
      return REFERENCE_DETAILED_1MA1;
    }

    const fallbackSpec = REFERENCE_SPECIFICATIONS.find((s) => s.id === specificationId);
    if (fallbackSpec) {
      return {
        ...fallbackSpec,
        subject: REFERENCE_SUBJECTS.find((s) => s.id === fallbackSpec.subject_id),
        qualification: fallbackSpec.qualification_id ? (REFERENCE_QUALIFICATIONS.find((q) => q.id === fallbackSpec.qualification_id) || null) : null,
        exam_board: fallbackSpec.exam_board_id ? (REFERENCE_EXAM_BOARDS.find((b) => b.id === fallbackSpec.exam_board_id) || null) : null,
        authority: fallbackSpec.authority_id ? (REFERENCE_AUTHORITIES.find((a) => a.id === fallbackSpec.authority_id) || null) : null,
        framework: fallbackSpec.framework_id ? (REFERENCE_FRAMEWORKS.find((f) => f.id === fallbackSpec.framework_id) || null) : null,
        stage: REFERENCE_STAGES.find((st) => st.id === fallbackSpec.stage_id),
        source: REFERENCE_SOURCES.find((src) => src.id === fallbackSpec.source_id),
        regulatory_conditions_source: fallbackSpec.regulatory_conditions_source_id
          ? (REFERENCE_SOURCES.find((src) => src.id === fallbackSpec.regulatory_conditions_source_id) || null)
          : null,
        assessment_objectives: [],
        topics: [],
        assessment_items: [],
      };
    }

    return null;
  },
};
