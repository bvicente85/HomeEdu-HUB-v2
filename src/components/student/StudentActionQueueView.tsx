import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Filter,
  X,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Student, StudentSubject } from '../../types/database';
import {
  studentActionQueueService,
  StudentActionQueueItem,
  StudentActionQueueReport,
} from '../../lib/studentActionQueueService';
import { StudentActionCard } from './StudentActionCard';
import { diagnosticService } from '../../lib/diagnosticService';
import { DiagnosticRunner } from '../DiagnosticRunner';

interface StudentActionQueueViewProps {
  student: Student | null;
  subjects: StudentSubject[];
}

type TabFilter = 'focus' | 'all' | 'diagnostic' | 'remediation' | 'blocked' | 'progression';

export const StudentActionQueueView: React.FC<StudentActionQueueViewProps> = ({
  student,
  subjects,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<StudentSubject | null>(null);
  const [queueReport, setQueueReport] = useState<StudentActionQueueReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('focus');

  // Diagnostic Runner execution modal state
  const [activeDiagnosticSessionId, setActiveDiagnosticSessionId] = useState<string | null>(null);
  const [activeDiagnosticObjectiveId, setActiveDiagnosticObjectiveId] = useState<string | null>(null);

  // Detail & Prerequisite inspect modal state
  const [inspectAction, setInspectAction] = useState<StudentActionQueueItem | null>(null);
  const [inspectBlockers, setInspectBlockers] = useState<string[] | null>(null);

  // Sync selected subject (default to bound math GCSE or first available)
  useEffect(() => {
    if (subjects.length > 0) {
      const boundSub =
        subjects.find((s) => s.specification_id || s.subject_name.toLowerCase().includes('math')) ||
        subjects[0];
      setSelectedSubject(boundSub);
    } else {
      setSelectedSubject(null);
    }
  }, [subjects]);

  const loadQueue = useCallback(async () => {
    if (!student || !selectedSubject?.specification_id) {
      setQueueReport(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const report = await studentActionQueueService.generateStudentActionQueue({
        studentId: student.id,
        studentSubjectId: selectedSubject.id,
        specificationId: selectedSubject.specification_id,
        activeDiagnosticSessionId,
        activeDiagnosticObjectiveId,
      });

      setQueueReport(report);
    } catch (err: any) {
      console.error('Failed to load student action queue:', err);
      setError(err?.message || 'Failed to load student action queue.');
    } finally {
      setIsLoading(false);
    }
  }, [student, selectedSubject, activeDiagnosticSessionId, activeDiagnosticObjectiveId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Handler: Launch Diagnostic Assessment Session
  const handleLaunchDiagnostic = async (action: StudentActionQueueItem) => {
    if (!student || !selectedSubject?.specification_id) return;
    try {
      setIsLoading(true);
      // Create planned diagnostic session for this target
      const planned = await diagnosticService.createPlannedSession({
        studentId: student.id,
        studentSubjectId: selectedSubject.id,
        specificationId: selectedSubject.specification_id,
        title: `Diagnostic: ${action.concept_title}`,
        purpose: 'Baseline competency assessment',
        targetPlans: [
          {
            target_order: 1,
            learning_objective_id: action.learning_objective_id,
            learning_objective_code: action.learning_objective_code,
            learning_objective_statement: action.student_subtitle,
            concept_id: action.concept_id,
            concept_code: action.concept_code,
            concept_title: action.concept_title,
            prerequisite_depth: 0,
            inclusion_reason: 'TARGET',
            tier_eligibility: 'ALL',
          },
        ],
      });

      setActiveDiagnosticSessionId(planned.session_id);
      setActiveDiagnosticObjectiveId(action.learning_objective_id);
    } catch (err: any) {
      alert(`Could not start diagnostic check-in: ${err?.message || String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitDiagnostic = () => {
    setActiveDiagnosticSessionId(null);
    setActiveDiagnosticObjectiveId(null);
    loadQueue();
  };

  // Filter actions for display
  const allActions = queueReport?.actions || [];

  const getFilteredActions = (): StudentActionQueueItem[] => {
    switch (activeTab) {
      case 'focus':
        // Top 3 to 5 actionable unblocked actions (Remediate or Diagnose)
        return allActions
          .filter((a) => a.action_status === 'AVAILABLE' && (a.action_type === 'REMEDIATE' || a.action_type === 'DIAGNOSE'))
          .slice(0, 5);
      case 'diagnostic':
        return allActions.filter((a) => a.action_type === 'DIAGNOSE' && a.action_status === 'AVAILABLE');
      case 'remediation':
        return allActions.filter((a) => a.action_type === 'REMEDIATE' && a.action_status === 'AVAILABLE');
      case 'blocked':
        return allActions.filter((a) => a.action_status === 'BLOCKED');
      case 'progression':
        return allActions.filter((a) => a.action_type === 'PROGRESS' || a.action_type === 'MAINTAIN');
      case 'all':
      default:
        return allActions;
    }
  };

  const displayedActions = getFilteredActions();

  return (
    <div className="space-y-6">
      {/* Subject & Header Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
              Active Learning Queue
            </span>
            <span className="text-2xs font-mono text-stone-400">Phase 2D.3c</span>
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight mt-1">
            What to Focus on Next
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Clear, unblocked learning actions prioritized from your curriculum goals.
          </p>
        </div>

        {/* Subject Selector & Refresh */}
        <div className="flex items-center gap-3">
          {subjects.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-stone-400 font-medium">Subject:</span>
              <select
                value={selectedSubject?.id || ''}
                onChange={(e) => {
                  const s = subjects.find((sub) => sub.id === e.target.value);
                  if (s) setSelectedSubject(s);
                }}
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-md text-xs text-stone-900 font-medium"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.subject_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadQueue}
            disabled={isLoading}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
            title="Refresh Action Queue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-stone-800' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bound Specification Notice */}
      {selectedSubject?.specification_id ? (
        <div className="bg-stone-50 border border-stone-200/80 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-stone-500 shrink-0" />
            <span>
              Curriculum Specification:{' '}
              <strong className="text-stone-900 font-semibold">
                {queueReport?.specification_name || 'Pearson Edexcel GCSE Mathematics (1MA1)'}
              </strong>
            </span>
          </div>
          <span className="text-2xs text-stone-400 font-mono">
            {queueReport?.actions.length || 0} Total Topic Targets
          </span>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Select a subject bound to a curriculum specification to view your learning queue.</span>
        </div>
      )}

      {/* Filter Tabs */}
      {queueReport && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-200 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('focus')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              activeTab === 'focus'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Top Focus ({queueReport.active_actions_count})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            All Actions ({queueReport.actions.length})
          </button>
          <button
            onClick={() => setActiveTab('diagnostic')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              activeTab === 'diagnostic'
                ? 'bg-sky-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Diagnostic Check-ins ({queueReport.diagnostic_checkins_count})
          </button>
          <button
            onClick={() => setActiveTab('remediation')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              activeTab === 'remediation'
                ? 'bg-amber-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Topic Practice
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              activeTab === 'blocked'
                ? 'bg-stone-800 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Upcoming Topics ({queueReport.blocked_actions_count})
          </button>
          <button
            onClick={() => setActiveTab('progression')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              activeTab === 'progression'
                ? 'bg-emerald-800 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Next Steps & Refresh ({queueReport.progression_count})
          </button>
        </div>
      )}

      {/* Action Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-stone-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-600" />
          <p className="text-sm font-medium">Preparing your personalized learning actions...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center text-rose-800 text-sm">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : displayedActions.length === 0 ? (
        <div className="p-12 text-center bg-stone-50 border border-stone-200 rounded-xl text-stone-500 text-sm">
          <CheckCircle2 className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="font-semibold text-stone-700">No actions in this category</p>
          <p className="text-xs mt-1">Switch to "Top Focus" or "All Actions" to view active learning goals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedActions.map((action) => (
            <StudentActionCard
              key={action.learning_objective_id}
              action={action}
              onLaunchDiagnostic={handleLaunchDiagnostic}
              onInspectPrerequisite={(blockers) => setInspectBlockers(blockers)}
              onInspectDetails={(a) => setInspectAction(a)}
            />
          ))}
        </div>
      )}

      {/* Goal Details Modal */}
      {inspectAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-stone-200 space-y-4 text-sm text-stone-700">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <span className="text-xs font-mono text-stone-400 font-semibold">{inspectAction.learning_objective_code}</span>
                <h3 className="text-base font-bold text-stone-900">{inspectAction.concept_title}</h3>
              </div>
              <button
                onClick={() => setInspectAction(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <span className="text-2xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Learning Target
              </span>
              <p className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-xs font-medium">
                {inspectAction.student_subtitle}
              </p>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1">
              <div>Topic: <strong>{inspectAction.topic_title}</strong></div>
              <div>Concept Code: <code className="text-stone-700">{inspectAction.concept_code}</code></div>
              <div>Status: <span className="font-semibold text-stone-900">{inspectAction.action_status}</span></div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectAction(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prerequisite Blocker Inspection Modal */}
      {inspectBlockers && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-stone-200 space-y-4 text-sm text-stone-700">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-stone-600" />
                <h3 className="text-base font-bold text-stone-900">Upcoming Topic Pathway</h3>
              </div>
              <button
                onClick={() => setInspectBlockers(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              This topic has prerequisite dependencies. To prepare effectively, focus on building foundations in:
            </p>

            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg space-y-1.5 text-xs">
              {inspectBlockers.map((b, i) => (
                <div key={i} className="flex items-center gap-2 font-medium text-stone-800">
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                  <span>{b}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectBlockers(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Phase 2C.3 Diagnostic Runner Modal */}
      {activeDiagnosticSessionId && student && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <DiagnosticRunner
              student={student}
              sessionId={activeDiagnosticSessionId}
              onExit={handleExitDiagnostic}
              onSessionCompleted={handleExitDiagnostic}
            />
          </div>
        </div>
      )}
    </div>
  );
};
