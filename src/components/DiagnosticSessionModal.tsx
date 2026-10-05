import React, { useState } from 'react';
import { Student, StudentSubject, LearningObjective } from '../types/database';
import { X, Check, Loader2, Sparkles, ClipboardCheck } from 'lucide-react';

interface DiagnosticSessionModalProps {
  isOpen: boolean;
  student: Student;
  subject: StudentSubject;
  availableObjectives: LearningObjective[];
  onClose: () => void;
  onCreate: (params: {
    title: string;
    purpose: string;
    selectedObjectiveIds: string[];
  }) => Promise<void>;
}

export const DiagnosticSessionModal: React.FC<DiagnosticSessionModalProps> = ({
  isOpen,
  student,
  subject,
  availableObjectives,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState(
    `Baseline Diagnostic — ${subject.subject_name} (${subject.qualification})`
  );
  const [purpose, setPurpose] = useState(
    'Establish academic baseline, identify prerequisite gaps, and map starting competency.'
  );
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>(
    availableObjectives.map((o) => o.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleObjective = (id: string) => {
    setSelectedObjectiveIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedObjectiveIds.length === availableObjectives.length) {
      setSelectedObjectiveIds([]);
    } else {
      setSelectedObjectiveIds(availableObjectives.map((o) => o.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a session title.');
      return;
    }
    if (selectedObjectiveIds.length === 0) {
      setError('Please select at least one learning objective target for this diagnostic session.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        purpose: purpose.trim(),
        selectedObjectiveIds,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule diagnostic session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl max-w-xl w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2 text-stone-900">
            <ClipboardCheck className="w-5 h-5 text-stone-700" />
            <h3 className="text-base font-semibold">Plan Diagnostic Assessment Session</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-stone-400 hover:text-stone-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded p-3 text-xs text-stone-700 space-y-1">
          <p>
            <strong>Target Learner:</strong> {student.first_name} ({student.year_group})
          </p>
          <p>
            <strong>Subject Context:</strong> {subject.subject_name} — {subject.exam_board} (
            {subject.qualification})
          </p>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Session Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Diagnostic Purpose / Baseline Goal
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              disabled={isSubmitting}
              className="w-full text-xs p-2.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-semibold text-stone-700 uppercase tracking-wider">
                Targeted Objectives ({selectedObjectiveIds.length}/{availableObjectives.length})
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-2xs text-stone-600 hover:text-stone-900 underline font-medium"
              >
                {selectedObjectiveIds.length === availableObjectives.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto border border-stone-200 rounded divide-y divide-stone-100 bg-stone-50/50 p-2 space-y-1">
              {availableObjectives.map((lo) => {
                const isSelected = selectedObjectiveIds.includes(lo.id);
                return (
                  <label
                    key={lo.id}
                    className="flex items-start gap-2 p-1.5 rounded hover:bg-white cursor-pointer select-none text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleObjective(lo.id)}
                      className="mt-0.5 rounded text-stone-900 focus:ring-stone-400"
                    />
                    <div className="flex-1">
                      <span className="font-mono text-2xs text-stone-500 font-semibold mr-1.5">
                        {lo.code}
                      </span>
                      <span className="text-stone-800">{lo.statement}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-stone-300 rounded text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-stone-900 text-white rounded font-medium hover:bg-stone-800 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Session...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Diagnostic Session</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
