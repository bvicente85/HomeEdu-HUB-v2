import React, { useState } from 'react';
import {
  LearningObjective,
  MasteryState,
  GapStatus,
  ConfidenceLevel,
  StudentLearningState,
} from '../types/database';
import { X, ShieldAlert, Check, Loader2 } from 'lucide-react';

interface ParentOverrideModalProps {
  isOpen: boolean;
  objective: LearningObjective;
  currentState?: StudentLearningState | null;
  studentName: string;
  onClose: () => void;
  onSave: (params: {
    newMasteryState: MasteryState;
    newGapStatus: GapStatus;
    confidenceLevel: ConfidenceLevel;
    notes: string;
  }) => Promise<void>;
}

export const ParentOverrideModal: React.FC<ParentOverrideModalProps> = ({
  isOpen,
  objective,
  currentState,
  studentName,
  onClose,
  onSave,
}) => {
  const [masteryState, setMasteryState] = useState<MasteryState>(
    currentState?.mastery_state || 'DEVELOPING'
  );
  const [gapStatus, setGapStatus] = useState<GapStatus>(
    currentState?.gap_status || 'ON_TRACK'
  );
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>(
    currentState?.confidence_level || 'MEDIUM'
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('Please provide a brief justification note for this administrative override.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        newMasteryState: masteryState,
        newGapStatus: gapStatus,
        confidenceLevel,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2 text-stone-900">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-semibold">Administrative Parent Override</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-stone-400 hover:text-stone-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-md p-3 text-xs text-amber-900 space-y-1">
          <p className="font-semibold">Audit Notice: PARENT_OVERRIDE</p>
          <p className="text-amber-800">
            This action explicitly overrides automated assessment evidence. It will be recorded as{' '}
            <code className="font-mono bg-amber-100 px-1 rounded text-2xs">PARENT_OVERRIDE</code> in{' '}
            <strong>{studentName}'s</strong> learning state history and evidence ledger.
          </p>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded p-3 text-xs">
          <span className="font-mono text-stone-500 font-semibold">{objective.code}</span>
          <p className="font-medium text-stone-900 mt-0.5">{objective.statement}</p>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* MASTERY STATE */}
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Evaluated Mastery State
            </label>
            <select
              value={masteryState}
              onChange={(e) => setMasteryState(e.target.value as MasteryState)}
              disabled={isSubmitting}
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="NOT_ASSESSED">NOT_ASSESSED (No meaningful evidence)</option>
              <option value="EMERGING">EMERGING (Early understanding, heavily supported)</option>
              <option value="DEVELOPING">DEVELOPING (Partial independence, active gaps)</option>
              <option value="SECURE">SECURE (Sufficient independent evidence)</option>
              <option value="MASTERED">MASTERED (Repeatable performance across contexts)</option>
            </select>
          </div>

          {/* GAP STATUS */}
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Curricular Gap Status
            </label>
            <select
              value={gapStatus}
              onChange={(e) => setGapStatus(e.target.value as GapStatus)}
              disabled={isSubmitting}
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="ON_TRACK">ON_TRACK (Progress is consistent with expectations)</option>
              <option value="DEVELOPING">DEVELOPING (Active learning in progress)</option>
              <option value="GAP">GAP (Direct gap identified on this objective)</option>
              <option value="PREREQUISITE_GAP">
                PREREQUISITE_GAP (Upstream prerequisite insecure, blocking progress)
              </option>
              <option value="NO_DATA">NO_DATA (Unassessed)</option>
            </select>
          </div>

          {/* CONFIDENCE / RELIABILITY */}
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Evidence Reliability / Confidence
            </label>
            <select
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(e.target.value as ConfidenceLevel)}
              disabled={isSubmitting}
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="LOW">LOW (Single observation or assisted exercise)</option>
              <option value="MEDIUM">MEDIUM (Standard unassisted homeschool work)</option>
              <option value="HIGH">HIGH (Repeated consistent independent demonstration)</option>
            </select>
          </div>

          {/* JUSTIFICATION NOTES */}
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Justification & Observation Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Demonstrated solving two-step linear equations independently during past paper practice (June 2024)."
              rows={3}
              required
              disabled={isSubmitting}
              className="w-full text-xs p-2.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
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
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Record Override</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
