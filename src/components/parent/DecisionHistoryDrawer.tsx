import React, { useState, useEffect } from 'react';
import { X, History, Clock, ArrowRight, ShieldCheck, FileText } from 'lucide-react';
import {
  priorityDecisionService,
  StudentPriorityDecisionHistory,
} from '../../lib/priorityDecisionService';
import { LearningPriority } from '../../lib/learningPriorityService';

interface DecisionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  priority?: LearningPriority | null;
}

export const DecisionHistoryDrawer: React.FC<DecisionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  studentId,
  priority,
}) => {
  const [historyEvents, setHistoryEvents] = useState<StudentPriorityDecisionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      loadHistory();
    }
  }, [isOpen, studentId, priority]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const events = await priorityDecisionService.getDecisionHistory(
        studentId,
        priority?.learning_objective_id
      );
      setHistoryEvents(events);
    } catch (err) {
      console.error('Failed to load decision history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-stone-700" />
            <div>
              <h3 className="text-base font-bold text-stone-900">Decision Audit History</h3>
              <p className="text-xs text-stone-500">
                {priority ? priority.concept_title : 'All Objective Decisions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-stone-700">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-md text-2xs text-stone-600 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Immutable Audit Ledger:</strong> Historical parental decision events are recorded permanently for home education records and cannot be altered or deleted.
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-stone-400">Loading audit history...</div>
          ) : historyEvents.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              No historical decision events recorded for this objective yet.
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-stone-200">
              {historyEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="relative pl-8 text-xs">
                  <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-stone-900 border-2 border-white" />
                  <div className="p-3.5 bg-white border border-stone-200 rounded-lg shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between gap-1 text-2xs text-stone-400">
                      <span className="font-mono">
                        {new Date(evt.event_timestamp).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="font-semibold text-stone-600">Event #{historyEvents.length - idx}</span>
                    </div>

                    {/* Transition */}
                    <div className="flex items-center gap-1.5 font-bold text-stone-900">
                      {evt.previous_decision_type ? (
                        <>
                          <span className="text-stone-400 font-normal">{evt.previous_decision_type}</span>
                          <ArrowRight className="w-3 h-3 text-stone-400" />
                        </>
                      ) : null}
                      <span className="text-emerald-700">{evt.new_decision_type}</span>
                      {evt.new_parent_order && (
                        <span className="text-stone-500 font-medium text-2xs">
                          (Custom Order #{evt.new_parent_order})
                        </span>
                      )}
                    </div>

                    {/* System snapshot at that time */}
                    <div className="text-2xs text-stone-500 bg-stone-50 p-2 rounded border border-stone-100">
                      <span>System at decision: </span>
                      <strong className="text-stone-800">{evt.system_tier_at_event} (Rank #{evt.system_rank_at_event})</strong>
                    </div>

                    {/* Reason */}
                    {evt.reason && (
                      <p className="text-2xs text-stone-600 italic">
                        Note: "{evt.reason}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
