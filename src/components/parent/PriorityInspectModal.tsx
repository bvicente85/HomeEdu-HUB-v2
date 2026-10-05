import React from 'react';
import {
  X,
  AlertTriangle,
  Compass,
  Lock,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Layers,
  FileCheck,
} from 'lucide-react';
import { LearningPriority } from '../../lib/learningPriorityService';
import { StudentPriorityDecision } from '../../lib/priorityDecisionService';

interface PriorityInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  priority: LearningPriority | null;
  decision?: StudentPriorityDecision;
  onViewHistory?: () => void;
}

export const PriorityInspectModal: React.FC<PriorityInspectModalProps> = ({
  isOpen,
  onClose,
  priority,
  decision,
  onViewHistory,
}) => {
  if (!isOpen || !priority) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-stone-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-stone-900 text-white">
                System Rank #{priority.priority_rank}
              </span>
              <span className="text-xs font-mono text-stone-500 font-semibold">{priority.learning_objective_code}</span>
            </div>
            <h2 className="text-base font-bold text-stone-900 mt-1">
              {priority.concept_title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-stone-700">
          {/* Statement & Curriculum Scope */}
          <div>
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
              Learning Objective Statement
            </h4>
            <p className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-stone-800 font-medium">
              {priority.learning_objective_statement}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 mt-2 font-medium">
              <span>Topic: <strong className="text-stone-800">{priority.topic_title}</strong></span>
              <span>Concept Code: <code className="text-stone-700">{priority.concept_code}</code></span>
            </div>
          </div>

          {/* Authoritative State & Gap Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-2xs text-stone-400 uppercase font-bold">Mastery State</span>
              <p className="text-sm font-bold text-stone-900 mt-0.5">{priority.mastery_state}</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-2xs text-stone-400 uppercase font-bold">Gap Status</span>
              <p className="text-sm font-bold text-stone-900 mt-0.5">{priority.gap_status}</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-2xs text-stone-400 uppercase font-bold">System Tier</span>
              <p className="text-sm font-bold text-stone-900 mt-0.5">Tier {priority.priority_tier_number}</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-2xs text-stone-400 uppercase font-bold">Action</span>
              <p className="text-sm font-bold text-stone-900 mt-0.5">{priority.recommended_action}</p>
            </div>
          </div>

          {/* Deterministic Explanation */}
          <div>
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
              Deterministic Prioritization Rationale
            </h4>
            <div className="p-3.5 rounded-lg bg-amber-50/50 border border-amber-200 text-stone-800 text-xs leading-relaxed">
              <p className="font-semibold text-stone-900 mb-1">
                Rationale Code: <code className="text-amber-800">{priority.rationale_code}</code>
              </p>
              <p>{priority.rationale}</p>
            </div>
          </div>

          {/* Prerequisite Blocker Inspection */}
          {priority.is_prerequisite_blocked && (
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-rose-700">
                <Lock className="w-3.5 h-3.5" />
                <span>Strict Prerequisite Blockers</span>
              </h4>
              <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200 text-xs space-y-1.5">
                <p className="font-medium text-rose-900">
                  This objective is deferred because the following strict prerequisite(s) have active gaps:
                </p>
                <ul className="list-disc list-inside space-y-1 text-rose-800 pl-1 font-medium">
                  {priority.blocking_concepts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Downstream Impact Inspection */}
          {priority.downstream_objective_count > 0 && (
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-stone-500" />
                <span>Downstream Curriculum Dependents ({priority.downstream_objective_count} Objectives)</span>
              </h4>
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600">
                <p>
                  Mastering this foundational concept unblocks <strong>{priority.downstream_concept_count} downstream concept(s)</strong> across the curriculum graph.
                </p>
              </div>
            </div>
          )}

          {/* Parent Decision State */}
          <div className="border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Current Parent Decision
                </h4>
                <p className="text-sm font-semibold text-stone-900 mt-0.5">
                  {decision ? (
                    <span>
                      {decision.decision_type} {decision.parent_priority_order ? `(Custom Order #${decision.parent_priority_order})` : ''}
                    </span>
                  ) : (
                    <span className="text-stone-400 font-normal">Not yet reviewed by parent</span>
                  )}
                </p>
                {decision?.parent_notes && (
                  <p className="text-xs text-stone-600 mt-1 italic">Note: "{decision.parent_notes}"</p>
                )}
              </div>
              {onViewHistory && (
                <button
                  onClick={onViewHistory}
                  className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded transition-colors"
                >
                  View Decision History
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-md transition-colors"
          >
            Close Inspection
          </button>
        </div>
      </div>
    </div>
  );
};
