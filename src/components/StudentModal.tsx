import React, { useState, useEffect } from 'react';
import {
  EducationalStage,
  EducationType,
  GcseStatus,
  Student,
} from '../types/database';
import {
  VALID_EDUCATIONAL_STAGES,
  VALID_EDUCATION_TYPES,
  VALID_GCSE_STATUSES,
  validateStudentForm,
  StudentFormErrors,
} from '../lib/validation';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';

interface StudentModalProps {
  isOpen: boolean;
  student: Student | null; // null if creating, populated if editing
  familyId: string;
  onClose: () => void;
  onSave: (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  student,
  familyId,
  onClose,
  onSave,
}) => {
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [educationType, setEducationType] = useState<EducationType>('Home education');
  const [yearGroup, setYearGroup] = useState<EducationalStage>('Year 10');
  const [gcseStatus, setGcseStatus] = useState<GcseStatus>('Currently studying GCSEs');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<StudentFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (student) {
      setFirstName(student.first_name);
      setDateOfBirth(student.date_of_birth || '');
      setEducationType(student.education_type);
      setYearGroup(student.year_group);
      setGcseStatus(student.gcse_status);
      setNotes(student.notes || '');
    } else {
      setFirstName('');
      setDateOfBirth('');
      setEducationType('Home education');
      setYearGroup('Year 10');
      setGcseStatus('Currently studying GCSEs');
      setNotes('');
    }
    setErrors({});
    setSubmitError(null);
  }, [student, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateStudentForm({
      first_name: firstName,
      year_group: yearGroup,
      education_type: educationType,
      gcse_status: gcseStatus,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        family_id: familyId,
        profile_id: student?.profile_id || null,
        first_name: firstName.trim(),
        date_of_birth: dateOfBirth || undefined,
        education_type: educationType,
        year_group: yearGroup,
        gcse_status: gcseStatus,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save student profile.';
      console.error('Failed to save student:', err);
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl max-w-xl w-full p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
              Academic Onboarding & Record
            </span>
            <h2 className="text-lg font-semibold text-stone-900 mt-0.5">
              {student ? 'Edit Student Profile' : 'Student Onboarding'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-sm transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 space-y-1">
              <strong className="font-semibold block text-rose-900">
                {submitError.includes('family_members') && submitError.includes('row-level security')
                  ? 'Supabase Database Migration Required'
                  : 'Submission Error'}
              </strong>
              <span>
                {submitError.includes('family_members') && submitError.includes('row-level security')
                  ? 'The cloud Supabase database rejected the family membership creation because the circular RLS dependency migration has not been executed yet. Please open Supabase Dashboard -> SQL Editor and run the script in "supabase/migrations/20261005_fix_family_bootstrapping_rls.sql".'
                  : submitError}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PERSONAL: First Name & Date of Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Oliver"
                disabled={isSubmitting}
                className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${
                  errors.first_name
                    ? 'border-rose-300 focus:ring-rose-400'
                    : 'border-stone-300 focus:ring-stone-400'
                } disabled:bg-stone-50`}
              />
              {errors.first_name && (
                <p className="text-xs text-rose-600 mt-1">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Date of Birth <span className="text-stone-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={isSubmitting}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
              />
            </div>
          </div>

          {/* EDUCATIONAL STAGE */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Educational Stage <span className="text-rose-500">*</span>
            </label>
            <select
              value={yearGroup}
              onChange={(e) => setYearGroup(e.target.value as EducationalStage)}
              disabled={isSubmitting}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white disabled:bg-stone-50"
            >
              {VALID_EDUCATIONAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            {errors.year_group && (
              <p className="text-xs text-rose-600 mt-1">{errors.year_group}</p>
            )}
            <p className="text-xs text-stone-500 mt-1">
              Key Stage 3 covers Years 7–9. Key Stage 4 (GCSE) covers Years 10–11.
            </p>
          </div>

          {/* EDUCATION TYPE */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Current Education Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={educationType}
              onChange={(e) => setEducationType(e.target.value as EducationType)}
              disabled={isSubmitting}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white disabled:bg-stone-50"
            >
              {VALID_EDUCATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.education_type && (
              <p className="text-xs text-rose-600 mt-1">{errors.education_type}</p>
            )}
          </div>

          {/* GCSE STATUS */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              GCSE Readiness Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={gcseStatus}
              onChange={(e) => setGcseStatus(e.target.value as GcseStatus)}
              disabled={isSubmitting}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white disabled:bg-stone-50"
            >
              {VALID_GCSE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {errors.gcse_status && (
              <p className="text-xs text-rose-600 mt-1">{errors.gcse_status}</p>
            )}
          </div>

          {/* Notes / Educational background */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Educational Notes & Context <span className="text-stone-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Focus on STEM subjects, preparing for summer 2027 examination series..."
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs px-4 py-2 font-medium text-stone-700 hover:text-stone-900 border border-stone-300 rounded-md hover:bg-stone-50 transition-colors disabled:opacity-50"
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
              <span>{isSubmitting ? 'Saving...' : student ? 'Save Changes' : 'Complete Onboarding'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
