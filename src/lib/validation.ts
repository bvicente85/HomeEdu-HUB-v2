import {
  EducationalStage,
  EducationType,
  ExamBoard,
  GcseStatus,
  SubjectQualification,
  SubjectStatus,
  SubjectTier,
} from '../types/database';

export const VALID_EDUCATIONAL_STAGES: EducationalStage[] = [
  'Year 7',
  'Year 8',
  'Year 9',
  'Year 10',
  'Year 11',
  'Post-16',
  'Other',
];

export const VALID_EDUCATION_TYPES: EducationType[] = [
  'Home education',
  'Mainstream school',
  'Online school',
  'College',
  'Other',
];

export const VALID_GCSE_STATUSES: GcseStatus[] = [
  'Preparing for GCSEs',
  'Currently studying GCSEs',
  'Not currently studying GCSEs',
  'Retaking GCSEs',
  'Not applicable',
];

export const VALID_QUALIFICATIONS: SubjectQualification[] = [
  'GCSE',
  'IGCSE',
  'National Curriculum Programme',
  'KS3 Core',
  'Entry Level',
  'BTEC',
  'Other',
];

export const VALID_EXAM_BOARDS: ExamBoard[] = [
  'AQA',
  'Edexcel / Pearson',
  'OCR',
  'WJEC / Eduqas',
  'Cambridge CIE',
  'Not applicable',
  'Other',
];

export const VALID_TIERS: SubjectTier[] = ['Higher', 'Foundation', 'Not applicable'];

export const VALID_SUBJECT_STATUSES: SubjectStatus[] = ['Active', 'Planned', 'Paused', 'Completed'];

export interface StudentFormErrors {
  first_name?: string;
  year_group?: string;
  education_type?: string;
  gcse_status?: string;
}

export function validateStudentForm(data: {
  first_name: string;
  year_group: string;
  education_type: string;
  gcse_status: string;
}): StudentFormErrors {
  const errors: StudentFormErrors = {};

  if (!data.first_name || data.first_name.trim().length === 0) {
    errors.first_name = 'Student first name is required.';
  } else if (data.first_name.trim().length > 50) {
    errors.first_name = 'Student first name cannot exceed 50 characters.';
  }

  if (!data.year_group || !VALID_EDUCATIONAL_STAGES.includes(data.year_group as EducationalStage)) {
    errors.year_group = 'Please select a valid educational stage (e.g. Year 7 – Year 11).';
  }

  if (!data.education_type || !VALID_EDUCATION_TYPES.includes(data.education_type as EducationType)) {
    errors.education_type = 'Please select the current education type.';
  }

  if (!data.gcse_status || !VALID_GCSE_STATUSES.includes(data.gcse_status as GcseStatus)) {
    errors.gcse_status = 'Please select the current GCSE status.';
  }

  return errors;
}

export interface SubjectFormErrors {
  subject_name?: string;
  qualification?: string;
  exam_board?: string;
  target_exam_year?: string;
}

export function validateSubjectForm(data: {
  subject_name: string;
  qualification: string;
  exam_board: string;
  target_exam_year?: number | string;
}): SubjectFormErrors {
  const errors: SubjectFormErrors = {};

  if (!data.subject_name || data.subject_name.trim().length === 0) {
    errors.subject_name = 'Subject name is required.';
  }

  if (!data.qualification || !VALID_QUALIFICATIONS.includes(data.qualification as SubjectQualification)) {
    errors.qualification = 'Please select a qualification type.';
  }

  if (!data.exam_board || !VALID_EXAM_BOARDS.includes(data.exam_board as ExamBoard)) {
    errors.exam_board = 'Please select an exam board or specification authority.';
  }

  if (data.target_exam_year) {
    const year = Number(data.target_exam_year);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < currentYear - 1 || year > currentYear + 10) {
      errors.target_exam_year = `Target year must be between ${currentYear - 1} and ${currentYear + 10}.`;
    }
  }

  return errors;
}
