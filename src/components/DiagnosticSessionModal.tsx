import React, { useState, useEffect } from 'react';
import { Student, StudentSubject } from '../types/database';
import { LearningObjective } from '../types/curriculum';
import { DiagnosticTargetPlan } from '../lib/prerequisiteGraph';
import { diagnosticService } from '../lib/diagnosticService';
import { X, Check, Loader2, ClipboardCheck, ArrowRight, ShieldAlert, GitCommit, Layers, AlertCircle } from 'lucide-react';

interface DiagnosticSessionModalProps {
  isOpen: boolean;
  student: Student;
  subject: StudentSubject;
  availableObjectives: LearningObjective[];
  onClose: () => void;
  onCreated?: () => void;
}

export const DiagnosticSessionModal: React.FC<DiagnosticSessionModalProps> = ({
  isOpen,
  student,
  subject,
  availableObjectives,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState(
    `Baseline Diagnostic — ${subject.subject_name} (${subject.qualification})`
  );
  const [purpose, setPurpose] = useState(
    'Establish academic baseline, identify prerequisite gaps, and map starting competency.'
  );
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('all');
  const [targetPlans, setTargetPlans] = useState<DiagnosticTargetPlan[]>([]);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !subject.specification_id) return;

    const runPrerequisiteAnalysis = async () => {
      setIsLoadingAnalysis(true);
      setError(null);
      try {
        const targetIds =
          selectedObjectiveId === 'all'
            ? availableObjectives.map((o) => o.id)
            : [selectedObjectiveId];

        const plans = await diagnosticService.selectDiagnosticTargets({
          studentId: student.id,
          studentSubjectId: subject.id,
          targetObjectiveIds: targetIds,
          includeRecommendedCoRequisites: true,
        });

        setTargetPlans(plans);

        if (selectedObjectiveId !== 'all') {
          const targetLo = availableObjectives.find((o) => o.id === selectedObjectiveId);
          if (targetLo) {
            setTitle(`Diagnostic: ${targetLo.code} & Prerequisites (${subject.subject_name})`);
            setPurpose(
              `Targeted diagnostic verifying foundational prerequisites for ${targetLo.code} (${targetLo.statement.slice(0, 60)}...).`
            );
          }
        } else {
          setTitle(`Full Baseline Diagnostic — ${subject.subject_name} (${subject.qualification})`);
          setPurpose(
            `Comprehensive baseline diagnostic assessing all ${plans.length} objectives ordered by disciplinary prerequisite depth.`
          );
        }
      } catch (err: any) {
        console.error('Failed to compute prerequisite targets:', err);
        setError(err?.message || 'Failed to analyze prerequisite graph.');
        setTargetPlans([]);
      } finally {
        setIsLoadingAnalysis(false);
      }
    };

    runPrerequisiteAnalysis();
  }, [isOpen, selectedObjectiveId, subject, student.id, availableObjectives]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a session title.');
      return;
    }
    if (targetPlans.length === 0) {
      setError('Cannot create session: No valid diagnostic targets generated.');
      return;
    }

    if (!subject.specification_id) {
      setError('SPECIFICATION_NOT_CONFIGURED: This subject has no bound specification.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await diagnosticService.createPlannedSession({
        studentId: student.id,
        studentSubjectId: subject.id,
        specificationId: subject.specification_id,
        title: title.trim(),
        purpose: purpose.trim(),
        targetPlans,
      });

      if (onCreated) {
        onCreated();
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule diagnostic session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2 text-stone-900">
            <ClipboardCheck className="w-5 h-5 text-stone-700" />
            <h3 className="text-base font-semibold">Plan Diagnostic Assessment Session</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-stone-400 hover:text-stone-600 p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Context Strip */}
        <div className="bg-stone-50 border border-stone-200 rounded p-3 text-xs text-stone-700 space-y-1">
          <div className="flex items-center justify-between">
            <p>
              <strong>Target Learner:</strong> {student.first_name} ({student.year_group})
            </p>
            <span className="font-mono text-2xs px-2 py-0.5 bg-stone-200 rounded text-stone-800">
              Tier: {subject.tier || 'Standard'}
            </span>
          </div>
          <p>
            <strong>Subject Context:</strong> {subject.subject_name} — {subject.exam_board} (
            {subject.qualification})
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
          {/* Target Objective Selector */}
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Target Learning Scope
            </label>
            <select
              value={selectedObjectiveId}
              onChange={(e) => setSelectedObjectiveId(e.target.value)}
              disabled={isSubmitting || isLoadingAnalysis}
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"
            >
              <option value="all">
                Comprehensive Baseline (All {availableObjectives.length} Specification Objectives)
              </option>
              {availableObjectives.map((lo) => (
                <option key={lo.id} value={lo.id}>
                  {lo.code} — {lo.statement.slice(0, 70)}...
                </option>
              ))}
            </select>
          </div>

          {/* Session Title */}
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

          {/* Purpose */}
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Diagnostic Purpose / Assessment Rationale
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              disabled={isSubmitting}
              className="w-full text-xs p-2.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Prerequisite Traversal Target Plan Inspection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-semibold text-stone-700 uppercase tracking-wider">
                Deterministic Target Sequence ({targetPlans.length} Steps)
              </label>
              {isLoadingAnalysis && (
                <span className="flex items-center gap-1 text-2xs text-stone-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Traversing DAG...</span>
                </span>
              )}
            </div>

            {targetPlans.length === 0 && !isLoadingAnalysis ? (
              <div className="p-4 text-center bg-stone-50 border border-stone-200 rounded text-stone-400">
                No targets found for the selected scope.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto border border-stone-200 rounded p-2.5 bg-stone-50/50">
                {targetPlans.map((plan, idx) => (
                  <div
                    key={plan.learning_objective_id}
                    className="p-2.5 rounded bg-white border border-stone-200 flex items-start justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono text-2xs font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-stone-900">
                            {plan.learning_objective_code}
                          </span>
                          <span
                            className={`text-3xs px-1.5 py-0.2 rounded font-semibold uppercase ${
                              plan.inclusion_reason === 'TARGET'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {plan.inclusion_reason === 'TARGET'
                              ? 'Target Objective'
                              : 'Strict Prerequisite'}
                          </span>
                          <span className="text-3xs text-stone-400 font-mono">
                            Depth {plan.prerequisite_depth}
                          </span>
                        </div>
                        <p className="text-xs text-stone-700 mt-0.5 line-clamp-1">
                          {plan.learning_objective_statement}
                        </p>
                        <p className="text-3xs text-stone-400 mt-0.5">
                          Concept: <strong>{plan.concept_title}</strong> ({plan.concept_code})
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
            <span className="text-2xs text-stone-500">
              Session will be saved in <strong>PLANNED</strong> state for parental review.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-1.5 border border-stone-300 text-stone-700 rounded text-xs hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || targetPlans.length === 0 || isLoadingAnalysis}
                className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scheduling Session...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Create Planned Session ({targetPlans.length} Targets)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
