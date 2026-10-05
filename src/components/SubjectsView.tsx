import React, { useState } from 'react';
import { StudentSubject, Student } from '../types/database';
import { Plus, Edit2, Trash2, Search, BookOpen } from 'lucide-react';

interface SubjectsViewProps {
  student: Student | null;
  subjects: StudentSubject[];
  onAddSubject: () => void;
  onEditSubject: (subject: StudentSubject) => void;
  onDeleteSubject: (subjectId: string) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  student,
  subjects,
  onAddSubject,
  onEditSubject,
  onDeleteSubject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Planned' | 'Completed'>('All');

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.exam_board.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.specification_code && s.specification_code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <span>{student ? `${student.first_name}'s Curriculum` : 'Curriculum Programme'}</span>
            <span aria-hidden="true">·</span>
            <span>English Exam Boards (AQA, Edexcel, OCR, Eduqas)</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Subjects & GCSE Specifications
          </h1>
        </div>

        <button
          onClick={onAddSubject}
          className="text-xs px-3.5 py-2 font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-stone-200 rounded-lg">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by subject, exam board, or specification code..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>

        {/* Status segmented controls */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md self-start sm:self-auto">
          {(['All', 'Active', 'Planned', 'Completed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                statusFilter === filter
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Subject Table */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        {filteredSubjects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-sm font-medium text-stone-700">No matching subjects found</p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {subjects.length === 0
                ? 'Register the first subject to begin mapping exam board specifications and study tiers.'
                : 'Try adjusting your search criteria or status filter.'}
            </p>
            {subjects.length === 0 && (
              <button
                onClick={onAddSubject}
                className="mt-2 text-xs px-3.5 py-2 font-medium text-stone-900 border border-stone-300 rounded-md hover:bg-stone-50"
              >
                Add Subject
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Subject Name</th>
                  <th className="py-3 px-4">Qualification</th>
                  <th className="py-3 px-4">Exam Board</th>
                  <th className="py-3 px-4">Spec Code</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4">Target Year</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSubjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-stone-900">
                      {sub.subject_name}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      {sub.qualification}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      {sub.exam_board}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-stone-600">
                      {sub.specification_code || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      {sub.tier || 'Not applicable'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-stone-600">
                      {sub.target_exam_year || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium text-stone-700">
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => onEditSubject(sub)}
                        className="p-1 text-stone-500 hover:text-stone-900 rounded transition-colors"
                        title="Edit subject specification"
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
    </div>
  );
};
