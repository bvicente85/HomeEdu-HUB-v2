import React, { useState, useEffect } from 'react';
import { Student } from '../types/database';
import {
  diagnosticRunnerService,
  DiagnosticSessionExecutionDetails,
} from '../lib/diagnosticRunnerService';
import { X, CheckCircle2, HelpCircle, Loader2, ClipboardCheck, Calendar, ShieldCheck, BookOpen } from 'lucide-react';

interface DiagnosticResultsModalProps {
  isOpen: boolean;
  student: Student;
  sessionId: string;
  onClose: () => void;
}

export const DiagnosticResultsModal: React.FC<DiagnosticResultsModalProps> = ({
  isOpen,
  student,
  sessionId,
  onClose,
}) => {
  const [details, setDetails] = useState<DiagnosticSessionExecutionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await diagnosticRunnerService.getSessionExecutionDetails(sessionId, student.id);
        setDetails(data);
      } catch (err: any) {
        console.error('Failed to load session results:', err);
        setError(err?.message || 'Failed to load session results.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [isOpen, sessionId, student.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2 text-stone-900">
            <ClipboardCheck className="w-5 h-5 text-stone-700" />
            <h3 className="text-base font-semibold">Diagnostic Assessment Audit Results</h3>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto" />
            <p className="text-xs text-stone-500">Loading diagnostic ledger data...</p>
          </div>
        ) : error || !details ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
            {error || 'Unable to load diagnostic session results.'}
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto pr-1 flex-1 text-xs">
            {/* Session Metadata Card */}
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-bold text-stone-900">{details.session.title}</h4>
                <span
                  className={`px-2 py-0.5 rounded text-2xs font-mono font-semibold ${
                    details.session.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-sky-100 text-sky-800 border border-sky-300'
                  }`}
                >
                  {details.session.status}
                </span>
              </div>
              {details.session.purpose && (
                <p className="text-xs text-stone-600 italic">{details.session.purpose}</p>
              )}
              <div className="flex items-center gap-4 text-2xs text-stone-500 pt-1 border-t border-stone-200/60 font-mono">
                <span>Learner: {student.first_name}</span>
                <span>•</span>
                <span>Created: {new Date(details.session.created_at).toLocaleDateString()}</span>
                {details.session.completed_at && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">
                      Completed: {new Date(details.session.completed_at).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Evaluated Target Ledger */}
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-stone-800 uppercase tracking-wider">
                Prerequisite Target Evaluations ({details.targets.length} Items)
              </h5>

              <div className="space-y-3">
                {details.targets.map((t, idx) => {
                  const attempt = t.attempt;
                  const item = t.assessment_item;
                  const isCorrect = attempt?.result === 'CORRECT';

                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-lg border border-stone-200 bg-white space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs font-bold bg-stone-100 px-2 py-0.5 rounded text-stone-700">
                            Step #{idx + 1}
                          </span>
                          <span className="font-mono text-xs font-bold text-stone-900">
                            {t.learning_objective_code}
                          </span>
                        </div>

                        {attempt ? (
                          <span
                            className={`px-2 py-0.5 rounded text-3xs font-semibold uppercase flex items-center gap-1 ${
                              isCorrect
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
                            <span>{attempt.result} ({attempt.raw_score}/{attempt.max_score} marks)</span>
                          </span>
                        ) : (
                          <span className="text-3xs px-2 py-0.5 rounded bg-stone-100 text-stone-500 font-mono">
                            PENDING
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-700">{t.learning_objective_statement}</p>

                      {/* Item and Attempt details */}
                      {item && (
                        <div className="bg-stone-50/60 p-3 rounded border border-stone-200/70 text-2xs space-y-1.5 font-mono">
                          <div className="flex items-center justify-between text-stone-500">
                            <span>Item Ref: {item.item_reference}</span>
                            <span>Format: {item.active_content?.content_format || item.item_type}</span>
                          </div>

                          {attempt && (
                            <div className="pt-1 border-t border-stone-200/60 text-stone-700">
                              <span className="text-stone-500">Submitted Response: </span>
                              <strong className="text-stone-900">{attempt.notes?.split('|')[0]?.replace('Submitted: ', '') || 'Recorded'}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 text-white rounded text-xs font-semibold hover:bg-stone-800 transition-colors"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
};
