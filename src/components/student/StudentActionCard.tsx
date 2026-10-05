import React from 'react';
import {
  Compass,
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Play,
  RotateCcw,
  BookOpen,
  Layers,
  Info,
} from 'lucide-react';
import { StudentActionQueueItem } from '../../lib/studentActionQueueService';

interface StudentActionCardProps {
  action: StudentActionQueueItem;
  onLaunchDiagnostic?: (action: StudentActionQueueItem) => void;
  onInspectPrerequisite?: (blockingConcepts: string[]) => void;
  onInspectDetails?: (action: StudentActionQueueItem) => void;
}

export const StudentActionCard: React.FC<StudentActionCardProps> = ({
  action,
  onLaunchDiagnostic,
  onInspectPrerequisite,
  onInspectDetails,
}) => {
  const isBlocked = action.action_status === 'BLOCKED';
  const isInProgress = action.action_status === 'IN_PROGRESS';

  // Student Badge styling
  const getBadgeStyle = () => {
    if (isBlocked) {
      return 'bg-stone-100 text-stone-700 border-stone-300';
    }
    switch (action.action_type) {
      case 'REMEDIATE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DIAGNOSE':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'PROGRESS':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'MAINTAIN':
        return 'bg-violet-100 text-violet-800 border-violet-200';
    }
  };

  const getBadgeIcon = () => {
    if (isBlocked) return <Lock className="w-3.5 h-3.5 text-stone-600" />;
    switch (action.action_type) {
      case 'REMEDIATE':
        return <HelpCircle className="w-3.5 h-3.5 text-amber-600" />;
      case 'DIAGNOSE':
        return <Compass className="w-3.5 h-3.5 text-sky-600" />;
      case 'PROGRESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'MAINTAIN':
        return <Sparkles className="w-3.5 h-3.5 text-violet-600" />;
    }
  };

  return (
    <div
      className={`border rounded-xl p-5 shadow-2xs transition-all flex flex-col justify-between gap-4 ${
        isBlocked
          ? 'bg-stone-50/70 border-stone-200 text-stone-600'
          : 'bg-white border-stone-200 hover:border-stone-300'
      }`}
    >
      <div>
        {/* Top Header & Provenance */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold">
              #{action.resolved_queue_order}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle()}`}
            >
              {getBadgeIcon()}
              {action.student_badge_label}
            </span>
          </div>

          {/* Provenance Badge */}
          <div>
            {action.is_parent_approved ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Parent-Approved Focus
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
                Curriculum Recommendation
              </span>
            )}
          </div>
        </div>

        {/* Concept Title & Topic */}
        <h3 className="text-base font-semibold text-stone-900 tracking-tight leading-snug mt-1">
          {action.student_title}
        </h3>
        <p className="text-xs text-stone-500 font-medium mt-0.5">
          {action.topic_title} · <span className="font-mono text-stone-400">{action.learning_objective_code}</span>
        </p>

        {/* Constructive Subtitle / Guidance */}
        <p className="text-xs text-stone-600 mt-2 leading-relaxed">
          {action.student_subtitle}
        </p>

        {/* Blocked Guidance Box */}
        {isBlocked && action.blocking_concept_titles.length > 0 && (
          <div className="mt-3 p-3 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-700 flex items-start gap-2">
            <Lock className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-stone-900">Unlocks after: </span>
              <span>{action.blocking_concept_titles.join(', ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="border-t border-stone-100 pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-2xs text-stone-400 font-medium">
          System: {action.system_priority_tier.replace(/_/g, ' ')} (Rank #{action.system_priority_rank})
        </div>

        <div className="flex items-center gap-2">
          {/* Diagnostic Action Button */}
          {action.can_launch_diagnostic && onLaunchDiagnostic && (
            <button
              onClick={() => onLaunchDiagnostic(action)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-900 hover:bg-sky-800 rounded-md transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              {isInProgress ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isInProgress ? 'Resume Check-in' : 'Start Check-in'}</span>
            </button>
          )}

          {/* Blocked Info Button */}
          {isBlocked && onInspectPrerequisite && (
            <button
              onClick={() => onInspectPrerequisite(action.blocking_concept_titles)}
              className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-200/80 hover:bg-stone-300 rounded-md transition-colors"
            >
              View Prerequisite
            </button>
          )}

          {/* Goal Details Button for Remediate / Progress / Maintain */}
          {!action.can_launch_diagnostic && !isBlocked && onInspectDetails && (
            <button
              onClick={() => onInspectDetails(action)}
              className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors inline-flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5 text-stone-500" />
              <span>Goal Details</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
