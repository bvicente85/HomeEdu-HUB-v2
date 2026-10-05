import React, { useState, useEffect } from 'react';
import { Student } from '../types/database';
import {
  diagnosticRunnerService,
  DiagnosticSessionExecutionDetails,
  DiagnosticSubmissionResult,
} from '../lib/diagnosticRunnerService';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ClipboardList,
  Check,
  ChevronLeft,
} from 'lucide-react';

interface DiagnosticRunnerProps {
  student: Student;
  sessionId: string;
  onExit: () => void;
  onSessionCompleted?: () => void;
}

export const DiagnosticRunner: React.FC<DiagnosticRunnerProps> = ({
  student,
  sessionId,
  onExit,
  onSessionCompleted,
}) => {
  const [details, setDetails] = useState<DiagnosticSessionExecutionDetails | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submittedValue, setSubmittedValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<DiagnosticSubmissionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadExecutionState = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await diagnosticRunnerService.getSessionExecutionDetails(sessionId, student.id);
      setDetails(data);
      setCurrentIndex(data.currentTargetIndex);
      setSubmissionResult(null);
      setSubmittedValue('');
    } catch (err: any) {
      console.error('Failed to load diagnostic session:', err);
      setErrorMessage(err?.message || 'Failed to load diagnostic session.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExecutionState();
  }, [sessionId, student.id]);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-stone-500" />
        <p className="text-xs text-stone-500 font-medium">Loading diagnostic assessment items...</p>
      </div>
    );
  }

  if (errorMessage || !details) {
    return (
      <div className="max-w-xl mx-auto p-6 bg-white rounded-lg border border-stone-200 shadow-sm space-y-4 my-8">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertCircle className="w-5 h-5" />
          <h3 className="text-sm font-bold">Unable to Open Diagnostic Assessment</h3>
        </div>
        <p className="text-xs text-stone-600">{errorMessage || 'Diagnostic session not found.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded hover:bg-stone-800 transition-colors"
        >
          Return to Learning Dashboard
        </button>
      </div>
    );
  }

  const { session, targets, isCompleted, totalTargets, completedTargets } = details;

  // Session Completed State
  if (isCompleted || (targets.length > 0 && targets.every((t) => t.status === 'ASSESSED' || t.attempt))) {
    return (
      <div className="max-w-2xl mx-auto my-8 bg-white rounded-xl border border-stone-200 shadow-md p-8 text-center space-y-6">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <span className="text-2xs uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Diagnostic Assessment Complete
          </span>
          <h2 className="text-xl font-bold text-stone-900 pt-2">{session.title}</h2>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            All {totalTargets} diagnostic targets were evaluated deterministically. Learning evidence has been recorded to {student.first_name}'s academic ledger.
          </p>
        </div>

        <div className="bg-stone-50 rounded-lg p-4 border border-stone-200 divide-y divide-stone-200/80 text-left text-xs">
          {targets.map((t, idx) => {
            const isCorrect = t.attempt?.result === 'CORRECT';
            return (
              <div key={t.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xs font-semibold text-stone-500">#{idx + 1}</span>
                    <span className="font-mono text-xs font-bold text-stone-900">{t.learning_objective_code}</span>
                  </div>
                  <p className="text-stone-600 truncate text-2xs mt-0.5">{t.learning_objective_statement}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCorrect ? (
                    <span className="px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Demonstrated</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-3xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      <span>Developing</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2">
          <button
            onClick={() => {
              if (onSessionCompleted) onSessionCompleted();
              onExit();
            }}
            className="px-6 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800 transition-colors shadow-sm"
          >
            Return to Learning State Ledger
          </button>
        </div>
      </div>
    );
  }

  const currentTarget = targets[currentIndex];
  const currentItem = currentTarget?.assessment_item;
  const currentContent = currentItem?.active_content || currentItem?.content?.[0];

  const handleOptionSelect = (optionId: string) => {
    if (!submissionResult && !isSubmitting) {
      setSubmittedValue(optionId);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedValue.trim()) {
      return;
    }
    if (!currentTarget || !currentItem) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await diagnosticRunnerService.submitResponse({
        studentId: student.id,
        sessionId: session.id,
        targetId: currentTarget.id,
        assessmentItemId: currentItem.id,
        submittedResponse: submittedValue.trim(),
      });

      setSubmissionResult(result);
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMessage(err?.message || 'Failed to submit response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextTarget = async () => {
    await loadExecutionState();
  };

  return (
    <div className="max-w-3xl mx-auto my-6 space-y-5 px-4">
      {/* Top Header Strip */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExit}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
            title="Exit Assessment"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <span className="text-3xs uppercase tracking-wider font-semibold text-stone-400 block">
              Diagnostic Session in Progress
            </span>
            <h2 className="text-sm font-bold text-stone-900 truncate">{session.title}</h2>
          </div>
        </div>

        {/* Progress Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-xs font-bold text-stone-900 font-mono">
              Step {currentIndex + 1} of {totalTargets}
            </span>
            <span className="text-3xs text-stone-500 block">
              {completedTargets} completed
            </span>
          </div>
          <div className="w-16 bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
            <div
              className="bg-stone-900 h-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalTargets) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Target & Learning Objective Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-6">
        {/* Objective & Tier Badge */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-stone-100 text-stone-800 rounded border border-stone-200">
              {currentTarget.learning_objective_code}
            </span>
            <span className="text-2xs font-medium text-stone-500">
              {currentTarget.learning_objective_statement}
            </span>
          </div>
          <span className="text-3xs px-2 py-0.5 font-semibold uppercase bg-stone-100 text-stone-600 rounded">
            {currentItem?.total_marks || 1} Mark{((currentItem?.total_marks || 1) > 1) ? 's' : ''}
          </span>
        </div>

        {/* Question Prompt Display */}
        <div className="bg-stone-50/70 p-5 rounded-lg border border-stone-200/90 text-sm font-serif text-stone-900 leading-relaxed whitespace-pre-line shadow-2xs">
          {currentContent?.prompt || 'Question prompt not loaded.'}
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Response Controls */}
        {!submissionResult ? (
          <form onSubmit={handleSubmitResponse} className="space-y-5">
            {/* MULTIPLE CHOICE OPTIONS */}
            {currentContent?.content_format === 'MULTIPLE_CHOICE' && currentContent.options && (
              <div className="space-y-2.5">
                <span className="text-2xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Select the correct answer:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentContent.options.map((opt) => {
                    const isSelected = submittedValue === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleOptionSelect(opt.id)}
                        disabled={isSubmitting}
                        className={`p-3.5 rounded-lg border text-left text-xs transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-stone-900 border-stone-900 text-white font-semibold shadow-xs'
                            : 'bg-white border-stone-300 text-stone-800 hover:bg-stone-50 hover:border-stone-400'
                        }`}
                      >
                        <span
                          className={`font-mono text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SHORT NUMERIC INPUT */}
            {currentContent?.content_format === 'SHORT_NUMERIC' && (
              <div className="space-y-2">
                <label className="block text-2xs font-semibold text-stone-600 uppercase tracking-wider">
                  Enter your numerical answer:
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={submittedValue}
                    onChange={(e) => setSubmittedValue(e.target.value)}
                    placeholder="e.g. 6 or 0.3333"
                    disabled={isSubmitting}
                    autoFocus
                    className="w-full text-sm font-mono px-3.5 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                  />
                  {currentContent.answer_unit && (
                    <span className="text-xs font-medium text-stone-500">{currentContent.answer_unit}</span>
                  )}
                </div>
              </div>
            )}

            {/* EXACT EXPRESSION INPUT */}
            {currentContent?.content_format === 'EXACT_EXPRESSION' && (
              <div className="space-y-2">
                <label className="block text-2xs font-semibold text-stone-600 uppercase tracking-wider">
                  Enter mathematical expression:
                </label>
                <div className="max-w-md">
                  <input
                    type="text"
                    value={submittedValue}
                    onChange={(e) => setSubmittedValue(e.target.value)}
                    placeholder="e.g. b - a"
                    disabled={isSubmitting}
                    autoFocus
                    className="w-full text-sm font-mono px-3.5 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 flex items-center justify-between border-t border-stone-100">
              <span className="text-3xs text-stone-400">
                Responses are evaluated deterministically against authoritative curriculum criteria.
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !submittedValue.trim()}
                className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating Response...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Deterministic Feedback & Next Step */
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <div
              className={`p-4 rounded-lg border flex items-center justify-between gap-3 ${
                submissionResult.is_correct
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {submissionResult.is_correct ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-bold">
                    {submissionResult.is_correct ? 'Correct response recorded' : 'Response recorded'}
                  </h4>
                  <p className="text-2xs opacity-80">
                    Awarded: {submissionResult.raw_score} / {submissionResult.max_score} marks · Learning state updated to{' '}
                    <strong>{submissionResult.new_mastery || 'UPDATED'}</strong>.
                  </p>
                </div>
              </div>

              <span className="font-mono text-xs font-bold bg-white/80 px-2.5 py-1 rounded border border-black/10">
                {submissionResult.evaluation_result}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleNextTarget}
                className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>{submissionResult.session_completed ? 'Complete Diagnostic Session' : 'Next Diagnostic Item'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
