import React, { useState, useEffect } from 'react';
import {
  ExamBoard,
  StudentSubject,
  SubjectQualification,
  SubjectStatus,
  SubjectTier,
} from '../types/database';
import {
  VALID_EXAM_BOARDS,
  VALID_QUALIFICATIONS,
  VALID_SUBJECT_STATUSES,
  VALID_TIERS,
  validateSubjectForm,
  SubjectFormErrors,
} from '../lib/validation';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';

interface SubjectModalProps {
  isOpen: boolean;
  subject: StudentSubject | null; // null if creating, populated if editing
  studentId: string;
  onClose: () => void;
  onSave: (data: Omit<StudentSubject, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  subject,
  studentId,
  onClose,
  onSave,
}) => {
  const currentYear = new Date().getFullYear();

  const [subjectName, setSubjectName] = useState('');
  const [qualification, setQualification] = useState<SubjectQualification>('GCSE');
  const [examBoard, setExamBoard] = useState<ExamBoard>('Edexcel / Pearson');
  const [specificationId, setSpecificationId] = useState<string | undefined>(undefined);
  const [specificationCode, setSpecificationCode] = useState('');
  const [tier, setTier] = useState<SubjectTier>('Higher');
  const [targetExamYear, setTargetExamYear] = useState<number | ''>(currentYear + 1);
  const [status, setStatus] = useState<SubjectStatus>('Active');
  const [errors, setErrors] = useState<SubjectFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (subject) {
      setSubjectName(subject.subject_name);
      setQualification(subject.qualification);
      setExamBoard(subject.exam_board);
      setSpecificationId(subject.specification_id || undefined);
      setSpecificationCode(subject.specification_code || '');
      setTier(subject.tier || 'Not applicable');
      setTargetExamYear(subject.target_exam_year || '');
      setStatus(subject.status);
    } else {
      setSubjectName('');
      setQualification('GCSE');
      setExamBoard('Edexcel / Pearson');
      setSpecificationId('00000007-0000-0000-0000-000000000001');
      setSpecificationCode('1MA1');
      setTier('Higher');
      setTargetExamYear(currentYear + 1);
      setStatus('Active');
    }
    setErrors({});
    setSubmitError(null);
  }, [subject, isOpen, currentYear]);

  const handleSelectSpecificationPreset = (specKey: string) => {
    if (specKey === '1MA1') {
      setSpecificationId('00000007-0000-0000-0000-000000000001');
      setSpecificationCode('1MA1');
      setSubjectName('Mathematics');
      setQualification('GCSE');
      setExamBoard('Edexcel / Pearson');
      setTier('Higher');
    } else if (specKey === 'DFE-KS3-MATHS') {
      setSpecificationId('00000007-0000-0000-0000-000000000002');
      setSpecificationCode('DFE-KS3-MATHS');
      setSubjectName('Mathematics');
      setQualification('National Curriculum Programme');
      setExamBoard('Not applicable');
      setTier('Not applicable');
    } else {
      setSpecificationId(undefined);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const validationErrors = validateSubjectForm({
      subject_name: subjectName,
      qualification,
      exam_board: examBoard,
      target_exam_year: targetExamYear === '' ? undefined : targetExamYear,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        student_id: studentId,
        subject_name: subjectName.trim(),
        qualification,
        exam_board: examBoard,
        programme_type: qualification === 'National Curriculum Programme' ? 'NATIONAL_CURRICULUM_PROGRAMME' : 'QUALIFICATION_SPECIFICATION',
        specification_id: specificationId,
        specification_code: specificationCode.trim() || undefined,
        tier: tier || 'Not applicable',
        target_exam_year: targetExamYear === '' ? undefined : Number(targetExamYear),
        status,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save subject.';
      console.error('Failed to save subject:', err);
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl max-w-lg w-full p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
              Curriculum Specification
            </span>
            <h2 className="text-lg font-semibold text-stone-900 mt-0.5">
              {subject ? 'Edit Subject' : 'Add Subject'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <strong className="font-semibold block text-rose-900">Submission Error</strong>
              <span>{submitError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Specification Link Preset */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1.5">
            <label className="block text-2xs font-semibold text-stone-700 uppercase tracking-wider">
              Accredited Specification Link (Phase 2A Knowledge Base)
            </label>
            <select
              value={specificationCode === '1MA1' ? '1MA1' : specificationCode === 'DFE-KS3-MATHS' ? 'DFE-KS3-MATHS' : 'custom'}
              onChange={(e) => handleSelectSpecificationPreset(e.target.value)}
              className="w-full text-xs font-medium px-2.5 py-1.5 border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="1MA1">Pearson Edexcel GCSE (9-1) Mathematics (1MA1)</option>
              <option value="DFE-KS3-MATHS">National Curriculum: Key Stage 3 Mathematics (DFE-KS3-MATHS)</option>
              <option value="custom">Other / Custom Course</option>
            </select>
            <p className="text-3xs text-stone-500">
              Links this subject directly to the accredited syllabus hierarchy, Assessment Objectives, and provenance records.
            </p>
          </div>

          {/* Subject Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Subject Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Mathematics, Biology, History..."
              className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${
                errors.subject_name
                  ? 'border-rose-300 focus:ring-rose-400'
                  : 'border-stone-300 focus:ring-stone-400'
              }`}
            />
            {errors.subject_name && (
              <p className="text-xs text-rose-600 mt-1">{errors.subject_name}</p>
            )}
          </div>

          {/* Programme / Qualification & Exam Board */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Programme / Qualification <span className="text-rose-500">*</span>
              </label>
              <select
                value={qualification}
                onChange={(e) => {
                  const val = e.target.value as SubjectQualification;
                  setQualification(val);
                  if (val === 'National Curriculum Programme') {
                    setExamBoard('Not applicable');
                    setTier('Not applicable');
                  }
                }}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"
              >
                {VALID_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q === 'National Curriculum Programme' ? 'National Curriculum Programme (KS3)' : q}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Awarding Body / Exam Board <span className="text-rose-500">*</span>
              </label>
              <select
                value={examBoard}
                onChange={(e) => setExamBoard(e.target.value as ExamBoard)}
                disabled={qualification === 'National Curriculum Programme'}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white disabled:bg-stone-100 disabled:text-stone-500"
              >
                {VALID_EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {qualification === 'National Curriculum Programme' && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 space-y-0.5">
              <span className="font-semibold block text-blue-900">Statutory Curriculum Programme (Stage Context)</span>
              <p className="text-3xs text-blue-700 leading-relaxed">
                Key Stage 3 is an education stage and statutory programme of study (DfE), not an awarding body qualification. Exam boards and tiering are not applicable.
              </p>
            </div>
          )}

          {/* Specification Code & Tier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Specification Code <span className="text-stone-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                value={specificationCode}
                onChange={(e) => setSpecificationCode(e.target.value)}
                placeholder="e.g. 1MA1 or 8464"
                className="w-full text-sm px-3 py-2 font-mono border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Tier
              </label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as SubjectTier)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"
              >
                {VALID_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Exam Year & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Target Exam Year <span className="text-stone-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="number"
                min={currentYear - 1}
                max={currentYear + 10}
                value={targetExamYear}
                onChange={(e) => setTargetExamYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`e.g. ${currentYear + 1}`}
                className="w-full text-sm font-mono tabular-nums px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              {errors.target_exam_year && (
                <p className="text-xs text-rose-600 mt-1">{errors.target_exam_year}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SubjectStatus)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"
              >
                {VALID_SUBJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 font-medium text-stone-700 hover:text-stone-900 border border-stone-300 rounded-md hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs px-4 py-2 font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? 'Saving...' : subject ? 'Save Changes' : 'Add Subject'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
