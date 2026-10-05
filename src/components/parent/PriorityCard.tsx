import React from 'react';
import {
  AlertTriangle,
  Compass,
  Lock,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Eye,
  Check,
  Clock,
  Shuffle,
  EyeOff,
  History,
  Info,
} from 'lucide-react';
import { LearningPriority } from '../../lib/learningPriorityService';
import { StudentPriorityDecision } from '../../lib/priorityDecisionService';

interface PriorityCardProps {
  priority: LearningPriority;
  decision?: StudentPriorityDecision;
  onInspect: (priority: LearningPriority) => void;
  onApprove: (priority: LearningPriority) => void;
  onDefer: (priority: LearningPriority) => void;
  onOverride: (priority: LearningPriority) => void;
  onExclude: (priority: LearningPriority) => void;
  onViewHistory: (priority: LearningPriority) => void;
}

export const PriorityCard: React.FC<PriorityCardProps> = ({
  priority,
  decision,
  onInspect,
  onApprove,
  onDefer,
  onOverride,
  onExclude,
  onViewHistory,
}) => {
  // Tier Visual Badges
  const getTierBadge = () => {
    switch (priority.priority_tier_number) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            CRITICAL FOUNDATIONAL GAP
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            DIRECT GAP
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-300">
            <Lock className="w-3.5 h-3.5 text-stone-600" />
            BLOCKED BY PREREQUISITE
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            DIAGNOSTIC REQUIRED
          </span>
        );
      case 5:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            READY TO PROGRESS
          </span>
        );
      case 6:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            MASTERED / MAINTENANCE
          </span>
        );
    }
  };

  const getActionBadge = () => {
    switch (priority.recommended_action) {
      case 'REMEDIATE':
        return <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Remediate</span>;
      case 'DIAGNOSE':
        return <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">Diagnose</span>;
      case 'DEFER':
        return <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">Defer</span>;
      case 'PROGRESS':
        return <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Progress</span>;
      case 'MAINTAIN':
        return <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Maintain</span>;
    }
  };

  const getDecisionBadge = () => {
    if (!decision) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
          Not Reviewed
        </span>
      );
    }
    switch (decision.decision_type) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
        );
      case 'DEFERRED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-700 border border-stone-300">
            <Clock className="w-3 h-3 text-stone-500" />
            Deferred
          </span>
        );
      case 'OVERRIDDEN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shuffle className="w-3 h-3 text-indigo-600" />
            Overridden {decision.parent_priority_order ? `· Order #${decision.parent_priority_order}` : ''}
          </span>
        );
      case 'EXCLUDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-stone-200 text-stone-600 border border-stone-300">
            <EyeOff className="w-3 h-3 text-stone-500" />
            Excluded
          </span>
        );
    }
  };

  const isStale = decision?.review_status === 'REVIEW_RECOMMENDED';

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between gap-4">
      {/* Header & Badges */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold">
              #{priority.priority_rank}
            </span>
            {getTierBadge()}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-stone-400 font-medium tracking-wide uppercase">
              Action: {getActionBadge()}
            </span>
          </div>
        </div>

        {/* Learning Objective & Concept */}
        <h3 className="text-base font-semibold text-stone-900 tracking-tight leading-snug">
          {priority.concept_title}
        </h3>
        <p className="text-xs text-stone-500 mt-0.5 font-medium">
          {priority.topic_title} · <span className="font-mono text-stone-400">{priority.learning_objective_code}</span>
        </p>
        <p className="text-sm text-stone-700 mt-2 line-clamp-2">
          {priority.learning_objective_statement}
        </p>

        {/* Deterministic Explanation / Rationale */}
        <div className="mt-3.5 p-3 rounded-md bg-stone-50 border border-stone-200/80 text-xs text-stone-700 leading-relaxed">
          <span className="font-semibold text-stone-900">Why prioritized: </span>
          {priority.rationale}
        </div>

        {/* Contextual Badges */}
        {priority.verification_recommended && (
          <div className="mt-2 text-2xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Independent verification recommended (support was utilized on previous attempts).</span>
          </div>
        )}
        {priority.retention_check_due && (
          <div className="mt-2 text-2xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Retention check recommended (&gt;90 days since last demonstration).</span>
          </div>
        )}
        {isStale && (
          <div className="mt-2 text-2xs font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Review recommended: New learning evidence may have changed this recommendation.</span>
          </div>
        )}
      </div>

      {/* System vs Parent Metadata & Actions */}
      <div className="border-t border-stone-100 pt-3 mt-1">
        <div className="flex flex-wrap items-center justify-between text-xs gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-stone-400 font-medium">System:</span>
            <span className="font-semibold text-stone-800">Tier {priority.priority_tier_number} · Rank #{priority.priority_rank}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-stone-400 font-medium">Parent Decision:</span>
            {getDecisionBadge()}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onInspect(priority)}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded transition-colors inline-flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5 text-stone-500" />
              <span>Inspect</span>
            </button>
            <button
              onClick={() => onViewHistory(priority)}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded transition-colors inline-flex items-center gap-1"
              title="View Decision History"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onApprove(priority)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors shadow-2xs"
            >
              Approve
            </button>
            <button
              onClick={() => onDefer(priority)}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded transition-colors"
            >
              Defer
            </button>
            <button
              onClick={() => onOverride(priority)}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded transition-colors"
            >
              Override
            </button>
            <button
              onClick={() => onExclude(priority)}
              className="px-2 py-1.5 text-xs font-medium text-stone-400 hover:text-stone-600 rounded transition-colors"
              title="Exclude from active planning"
            >
              Exclude
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
