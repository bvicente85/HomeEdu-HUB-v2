import React from 'react';
import { Student, StudentSubject } from '../types/database';
import {
  GraduationCap,
  CalendarCheck,
  FileText,
  FolderLock,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  ExternalLink,
  UserPlus,
  Eye,
} from 'lucide-react';

interface ParentDashboardProps {
  student: Student | null;
  allStudents: Student[];
  subjects: StudentSubject[];
  onSelectStudent: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onAddNewStudent: () => void;
  onPreviewStudent: () => void;
  onAddSubject: () => void;
  onEditSubject: (subject: StudentSubject) => void;
  onDeleteSubject: (subjectId: string) => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  student,
  allStudents,
  subjects,
  onSelectStudent,
  onEditStudent,
  onAddNewStudent,
  onPreviewStudent,
  onAddSubject,
  onEditSubject,
  onDeleteSubject,
}) => {
  if (!student) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <GraduationCap className="w-10 h-10 text-stone-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-stone-900">No Student Profile Registered</h2>
        <p className="text-sm text-stone-500 mt-1 max-w-md mx-auto">
          Start by completing the student onboarding flow to set up their educational stage, GCSE status, and subjects.
        </p>
        <button
          onClick={onAddNewStudent}
          className="mt-6 px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard Student</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Student Selector & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <span>Parent Oversight & Administration</span>
            <span aria-hidden="true">·</span>
            <span>Family Master Record</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Student Academic Profile
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {allStudents.length > 1 && (
            <select
              value={student.id}
              onChange={(e) => {
                const found = allStudents.find((s) => s.id === e.target.value);
                if (found) onSelectStudent(found);
              }}
              className="text-xs bg-white border border-stone-300 rounded-md px-3 py-1.5 font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} ({s.year_group})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={onPreviewStudent}
            className="text-xs px-3 py-1.5 font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors flex items-center gap-1.5"
            title="Preview the student interface without changing your authentication role"
          >
            <Eye className="w-3.5 h-3.5 text-stone-500" />
            <span>Preview Student View</span>
          </button>

          <button
            onClick={() => onEditStudent(student)}
            className="text-xs px-3 py-1.5 font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5 text-stone-500" />
            <span>Edit Profile</span>
          </button>

          <button
            onClick={onAddNewStudent}
            className="text-xs px-3 py-1.5 font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors flex items-center gap-1.5"
            title="Register another student in the family"
          >
            <UserPlus className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden sm:inline">Add Sibling</span>
          </button>
        </div>
      </div>

      {/* Core Profile Card */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
              Student Record
            </span>
            <h2 className="text-xl font-semibold text-stone-900 mt-1">{student.first_name}</h2>
            {/* Unboxed clean metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 mt-2">
              <span className="font-semibold text-stone-900">{student.year_group}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span>{student.education_type}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span>{student.gcse_status}</span>
              {student.date_of_birth && (
                <>
                  <span aria-hidden="true" className="text-stone-300">·</span>
                  <span className="font-mono tabular-nums">DOB: {student.date_of_birth}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3 Detail Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              Educational Stage
            </h3>
            <p className="font-medium text-stone-900">{student.year_group}</p>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Mapped against the English National Curriculum Key Stage bands (KS3: Years 7–9; KS4 / GCSE: Years 10–11).
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              GCSE Readiness Status
            </h3>
            <p className="font-medium text-stone-900">{student.gcse_status}</p>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Specifies examination alignment and informs future revision timetable pacing.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              Provision Mode
            </h3>
            <p className="font-medium text-stone-900">{student.education_type}</p>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Provides regulatory context for local authority Elective Home Education (EHE) expectations.
            </p>
          </div>
        </div>

        {student.notes && (
          <div className="pt-4 border-t border-stone-100 text-xs text-stone-600">
            <strong className="font-semibold text-stone-800">Family Educational Notes:</strong>{' '}
            {student.notes}
          </div>
        )}
      </div>

      {/* Subjects Section */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Enrolled Subjects & Specifications</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Subject definitions, exam boards (AQA, Pearson Edexcel, OCR, WJEC/Eduqas), specifications, and target years.
            </p>
          </div>
          <button
            onClick={onAddSubject}
            className="text-xs px-3.5 py-2 font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="border border-dashed border-stone-200 rounded-md p-8 text-center bg-stone-50/50 space-y-2">
            <p className="text-sm font-medium text-stone-700">No subjects registered yet</p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Add individual KS3 or GCSE subjects with their respective exam boards to begin structuring study programmes.
            </p>
            <button
              onClick={onAddSubject}
              className="mt-3 text-xs px-3 py-1.5 font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50"
            >
              Add First Subject
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 pr-4">Subject</th>
                  <th className="py-2.5 px-4">Qualification</th>
                  <th className="py-2.5 px-4">Exam Board / Code</th>
                  <th className="py-2.5 px-4">Tier</th>
                  <th className="py-2.5 px-4">Target Year</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-stone-900">
                      {sub.subject_name}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      {sub.qualification}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      <span>{sub.exam_board}</span>
                      {sub.specification_code && (
                        <span className="font-mono text-stone-500 ml-1.5">
                          ({sub.specification_code})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      {sub.tier || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-stone-600">
                      {sub.target_exam_year || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium text-stone-700">
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => onEditSubject(sub)}
                        className="p-1 text-stone-500 hover:text-stone-900 rounded transition-colors"
                        title="Edit subject"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSubject(sub.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors"
                        title="Remove subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Future Architecture Extension Placeholders (Items 4, 7, 8) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Phase 2 & Future Architecture Placeholders
          </span>
          <span className="text-xs text-stone-400">· Extension Points</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Placeholder: Curriculum-Aware Learning Plans */}
          <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2 text-stone-800">
              <CalendarCheck className="w-4 h-4 text-stone-600" />
              <h3 className="text-sm font-semibold">Weekly Learning Plan</h3>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Curriculum-aware automated timetables calibrated to English Key Stage 3 and GCSE specifications will be
              integrated following the curriculum research phase.
            </p>
            <div className="text-xs text-stone-400 font-mono">
              Status: Reserved for Phase 2
            </div>
          </div>

          {/* Placeholder: Private Evidence & Work Portfolio */}
          <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2 text-stone-800">
              <FolderLock className="w-4 h-4 text-stone-600" />
              <h3 className="text-sm font-semibold">Evidence Portfolio</h3>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Supabase private storage bucket <code className="font-mono text-stone-700">student-evidence</code> is
              provisioned with RLS policies to safeguard student essays, mock papers, and coursework.
            </p>
            <div className="text-xs text-stone-400 font-mono">
              Bucket: Private Storage Prepared
            </div>
          </div>

          {/* Placeholder: EHE Progress Reporting */}
          <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2 text-stone-800">
              <FileText className="w-4 h-4 text-stone-600" />
              <h3 className="text-sm font-semibold">EHE Progress Reports</h3>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Structured export engine for Elective Home Education annual monitoring reports, documenting a suitable, full-time
              education under Section 7 of the Education Act 1996.
            </p>
            <div className="text-xs text-stone-400 font-mono">
              Status: Reserved for Phase 2
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
