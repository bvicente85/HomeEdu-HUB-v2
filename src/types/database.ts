/**
 * Database and Domain Types for HomeEdu Hub (Phase 1)
 * British English conventions used throughout.
 */

export type UserRole = 'parent' | 'student';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  profile_id: string;
  role: UserRole;
  created_at: string;
}

export type EducationalStage =
  | 'Year 7'
  | 'Year 8'
  | 'Year 9'
  | 'Year 10'
  | 'Year 11'
  | 'Post-16'
  | 'Other';

export type EducationType =
  | 'Mainstream school'
  | 'Online school'
  | 'Home education'
  | 'College'
  | 'Other';

export type GcseStatus =
  | 'Not currently studying GCSEs'
  | 'Preparing for GCSEs'
  | 'Currently studying GCSEs'
  | 'Retaking GCSEs'
  | 'Not applicable';

export interface Student {
  id: string;
  family_id: string;
  profile_id?: string | null;
  first_name: string;
  date_of_birth?: string;
  education_type: EducationType;
  year_group: EducationalStage;
  gcse_status: GcseStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type SubjectQualification =
  | 'GCSE'
  | 'IGCSE'
  | 'National Curriculum Programme'
  | 'KS3 Core'
  | 'Entry Level'
  | 'BTEC'
  | 'Other';

export type ExamBoard =
  | 'AQA'
  | 'Edexcel / Pearson'
  | 'OCR'
  | 'WJEC / Eduqas'
  | 'Cambridge CIE'
  | 'Not applicable'
  | 'Other';

export type SubjectTier = 'Higher' | 'Foundation' | 'Not applicable';

export type SubjectStatus = 'Active' | 'Completed' | 'Paused' | 'Planned';

export interface StudentSubject {
  id: string;
  student_id: string;
  subject_name: string;
  qualification: SubjectQualification;
  exam_board: ExamBoard;
  programme_type?: import('./curriculum').ProgrammeType;
  specification_id?: string | null;
  specification_code?: string | null;
  tier?: SubjectTier | null;
  target_exam_year?: number | null;
  status: SubjectStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentWithSubjects extends Student {
  subjects: StudentSubject[];
}

export * from './curriculum';
export * from './learningState';

