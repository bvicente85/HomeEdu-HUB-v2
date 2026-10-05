import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Shuffle, Clock, EyeOff, Check } from 'lucide-react';
import { LearningPriority } from '../../lib/learningPriorityService';
import { ParentDecisionType } from '../../lib/priorityDecisionService';

interface DecisionActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  priority: LearningPriority | null;
  actionType: ParentDecisionType;
  onSaveDecision: (params: {
    decisionType: ParentDecisionType;
    parentPriorityOrder?: number | null;
    parentNotes?: string | null;
  }) => Promise<void>;
}

export const DecisionActionModal: React.FC<DecisionActionModalProps> = ({
  isOpen,
  onClose,
  priority,
  actionType,
  onSaveDecision,
}) => {
  const [customOrder, setCustomOrder] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (priority) {
      if (actionType === 'OVERRIDDEN') {
        setCustomOrder(priority.priority_rank);
      } else {
        setCustomOrder('');
      }
      setNotes('');
    }
  }, [priority, actionType]);

  if (!isOpen || !priority) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSaveDecision({
        decisionType: actionType,
        parentPriorityOrder: typeof customOrder === 'number' ? customOrder : null,
        parentNotes: notes.trim() ? notes.trim() : null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case 'APPROVED':
        return 'Approve Study Priority';
      case 'DEFERRED':
        return 'Defer Learning Priority';
      case 'OVERRIDDEN':
        return 'Override Priority Order';
      case 'EXCLUDED':
        return 'Exclude Priority from Active Queue';
    }
  };

  const getIcon = () => {
    switch (actionType) {
      case 'APPROVED':
        return <Check className="w-5 h-5 text-emerald-600" />;
      case 'DEFERRED':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'OVERRIDDEN':
        return <Shuffle className="w-5 h-5 text-indigo-600" />;
      case 'EXCLUDED':
        return <EyeOff className="w-5 h-5 text-stone-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/60">
          <div className="flex items-center gap-2.5">
            {getIcon()}
            <div>
              <h3 className="text-base font-bold text-stone-900">{getTitle()}</h3>
              <p className="text-xs text-stone-500">{priority.concept_title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm text-stone-700">
          {/* Prerequisite Blocker Non-blocking Warning (for OVERRIDE or APPROVE on Tier 3) */}
          {priority.priority_tier_number === 3 && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Unresolved Prerequisite Notice:</strong>
                <p className="mt-0.5 leading-relaxed">
                  This objective is blocked by prerequisite gap(s) in: <strong>{priority.blocking_concepts.join(', ')}</strong>. You can choose to prioritize it, but the underlying mathematical dependency remains unresolved.
                </p>
              </div>
            </div>
          )}

          {/* System vs Parent Info */}
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs flex justify-between items-center">
            <div>
              <span className="text-stone-400 block font-medium">System Recommendation:</span>
              <strong className="text-stone-900">Tier {priority.priority_tier_number} · Rank #{priority.priority_rank}</strong>
            </div>
            <div className="text-right">
              <span className="text-stone-400 block font-medium">Action:</span>
              <strong className="text-stone-900">{priority.recommended_action}</strong>
            </div>
          </div>

          {/* Custom Order input for OVERRIDE */}
          {actionType === 'OVERRIDDEN' && (
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Parent Priority Order
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={customOrder}
                onChange={(e) => setCustomOrder(e.target.value ? parseInt(e.target.value, 10) : '')}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900"
                placeholder="e.g. 1"
              />
              <p className="text-2xs text-stone-500 mt-1">
                Assign a custom sequence number. The system recommendation will remain recorded as Rank #{priority.priority_rank}.
              </p>
            </div>
          )}

          {/* Notes / Reason Field */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Parent Notes / Reason (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900"
              placeholder={
                actionType === 'DEFERRED'
                  ? 'e.g. Focusing on statistics unit before algebra remediation'
                  : 'Optional note for decision audit history'
              }
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-800 bg-stone-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-md transition-colors shadow-2xs"
            >
              {isSubmitting ? 'Saving Decision...' : 'Confirm Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
