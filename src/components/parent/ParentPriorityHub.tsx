import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Compass,
  Lock,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  Layers,
  BookOpen,
  Filter,
} from 'lucide-react';
import { Student, StudentSubject } from '../../types/database';
import {
  learningPriorityService,
  LearningPriority,
  StudentPriorityReport,
} from '../../lib/learningPriorityService';
import {
  priorityDecisionService,
  StudentPriorityDecision,
  ParentDecisionType,
} from '../../lib/priorityDecisionService';
import { PriorityCard } from './PriorityCard';
import { PriorityInspectModal } from './PriorityInspectModal';
import { DecisionActionModal } from './DecisionActionModal';
import { DecisionHistoryDrawer } from './DecisionHistoryDrawer';

interface ParentPriorityHubProps {
  students: Student[];
  selectedStudent: Student | null;
  onSelectStudent: (student: Student) => void;
  subjects: StudentSubject[];
}

type FilterTab = 'focus' | 'all' | 'remediation' | 'diagnostic' | 'blocked' | 'ontrack' | 'excluded';

export const ParentPriorityHub: React.FC<ParentPriorityHubProps> = ({
  students,
  selectedStudent,
  onSelectStudent,
  subjects,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<StudentSubject | null>(null);
  const [prioritiesReport, setPrioritiesReport] = useState<StudentPriorityReport | null>(null);
  const [decisions, setDecisions] = useState<StudentPriorityDecision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active filter tab
  const [activeTab, setActiveTab] = useState<FilterTab>('focus');

  // Modals state
  const [inspectPriority, setInspectPriority] = useState<LearningPriority | null>(null);
  const [decisionModalPriority, setDecisionModalPriority] = useState<LearningPriority | null>(null);
  const [decisionModalAction, setDecisionModalAction] = useState<ParentDecisionType>('DEFERRED');
  const [historyDrawerPriority, setHistoryDrawerPriority] = useState<LearningPriority | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Success notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync selected subject
  useEffect(() => {
    if (subjects.length > 0) {
      const mathSub =
        subjects.find((s) => s.specification_id || s.subject_name.toLowerCase().includes('math')) ||
        subjects[0];
      setSelectedSubject(mathSub);
    } else {
      setSelectedSubject(null);
    }
  }, [subjects]);

  // Load priorities and decisions
  const loadData = useCallback(async () => {
    if (!selectedStudent || !selectedSubject?.specification_id) {
      setPrioritiesReport(null);
      setDecisions([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [report, currentDecisions] = await Promise.all([
        learningPriorityService.generateStudentPriorities({
          studentId: selectedStudent.id,
          studentSubjectId: selectedSubject.id,
          specificationId: selectedSubject.specification_id,
        }),
        priorityDecisionService.getCurrentDecisionsForStudent(
          selectedStudent.id,
          selectedSubject.id
        ),
      ]);

      setPrioritiesReport(report);
      setDecisions(currentDecisions);
    } catch (err: any) {
      console.error('Failed to load priority data:', err);
      setError(err?.message || 'Failed to load deterministic learning priorities.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedStudent, selectedSubject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Decision Map lookup
  const decisionMap = new Map<string, StudentPriorityDecision>();
  decisions.forEach((d) => decisionMap.set(d.learning_objective_id, d));

  // Quick Approve Handler
  const handleQuickApprove = async (priority: LearningPriority) => {
    if (!selectedStudent || !selectedSubject) return;
    try {
      await priorityDecisionService.recordDecision({
        studentId: selectedStudent.id,
        studentSubjectId: selectedSubject.id,
        learningObjectiveId: priority.learning_objective_id,
        decisionType: 'APPROVED',
        systemTier: priority.priority_tier,
        systemRank: priority.priority_rank,
        currentState: {
          masteryState: priority.mastery_state,
          gapStatus: priority.gap_status,
          evidenceCount: 1,
        },
      });
      showToast(`Approved "${priority.concept_title}" for study planning.`);
      await loadData();
    } catch (err: any) {
      alert(`Failed to approve priority: ${err?.message || String(err)}`);
    }
  };

  // Save Modal Decision Handler
  const handleSaveModalDecision = async (params: {
    decisionType: ParentDecisionType;
    parentPriorityOrder?: number | null;
    parentNotes?: string | null;
  }) => {
    if (!selectedStudent || !selectedSubject || !decisionModalPriority) return;
    await priorityDecisionService.recordDecision({
      studentId: selectedStudent.id,
      studentSubjectId: selectedSubject.id,
      learningObjectiveId: decisionModalPriority.learning_objective_id,
      decisionType: params.decisionType,
      parentPriorityOrder: params.parentPriorityOrder,
      parentNotes: params.parentNotes,
      systemTier: decisionModalPriority.priority_tier,
      systemRank: decisionModalPriority.priority_rank,
      currentState: {
        masteryState: decisionModalPriority.mastery_state,
        gapStatus: decisionModalPriority.gap_status,
        evidenceCount: 1,
      },
    });
    showToast(`Decision recorded for "${decisionModalPriority.concept_title}".`);
    await loadData();
  };

  // Action Triggers
  const openDecisionModal = (priority: LearningPriority, action: ParentDecisionType) => {
    setDecisionModalPriority(priority);
    setDecisionModalAction(action);
  };

  const openHistory = (priority: LearningPriority) => {
    setHistoryDrawerPriority(priority);
    setIsHistoryDrawerOpen(true);
  };

  // Filter Logic
  const allPriorities = prioritiesReport?.priorities || [];

  const getFilteredPriorities = (): LearningPriority[] => {
    switch (activeTab) {
      case 'focus':
        // Top 3 to 5 actionable priorities (Tiers 1, 2, 4) excluding excluded items
        return allPriorities
          .filter((p) => {
            const dec = decisionMap.get(p.learning_objective_id);
            if (dec?.decision_type === 'EXCLUDED') return false;
            return p.priority_tier_number === 1 || p.priority_tier_number === 2 || p.priority_tier_number === 4;
          })
          .slice(0, 5);

      case 'remediation':
        return allPriorities.filter(
          (p) => (p.priority_tier_number === 1 || p.priority_tier_number === 2) && decisionMap.get(p.learning_objective_id)?.decision_type !== 'EXCLUDED'
        );

      case 'diagnostic':
        return allPriorities.filter(
          (p) => p.priority_tier_number === 4 && decisionMap.get(p.learning_objective_id)?.decision_type !== 'EXCLUDED'
        );

      case 'blocked':
        return allPriorities.filter(
          (p) => p.priority_tier_number === 3 && decisionMap.get(p.learning_objective_id)?.decision_type !== 'EXCLUDED'
        );

      case 'ontrack':
        return allPriorities.filter(
          (p) => (p.priority_tier_number === 5 || p.priority_tier_number === 6) && decisionMap.get(p.learning_objective_id)?.decision_type !== 'EXCLUDED'
        );

      case 'excluded':
        return allPriorities.filter(
          (p) => decisionMap.get(p.learning_objective_id)?.decision_type === 'EXCLUDED'
        );

      case 'all':
      default:
        return allPriorities.filter(
          (p) => decisionMap.get(p.learning_objective_id)?.decision_type !== 'EXCLUDED'
        );
    }
  };

  const displayedPriorities = getFilteredPriorities();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white text-xs px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-stone-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Context Selectors */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
              Parent Decision Hub
            </span>
            <span className="text-2xs font-mono text-stone-400">Phase 2D.3</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight mt-1">
            Learning Priorities & Focus Areas
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Deterministic curriculum intelligence. Review recommendations and approve priorities for study planning.
          </p>
        </div>

        {/* Student & Subject Selection */}
        <div className="flex flex-wrap items-center gap-3">
          {students.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-stone-400 font-medium">Student:</span>
              <select
                value={selectedStudent?.id || ''}
                onChange={(e) => {
                  const s = students.find((st) => st.id === e.target.value);
                  if (s) onSelectStudent(s);
                }}
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-md text-xs text-stone-900 font-medium"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.first_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {subjects.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-stone-400 font-medium">Subject:</span>
              <select
                value={selectedSubject?.id || ''}
                onChange={(e) => {
                  const sub = subjects.find((s) => s.id === e.target.value);
                  if (sub) setSelectedSubject(sub);
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
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
            title="Refresh Priorities"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-stone-800' : ''}`} />
          </button>
        </div>
      </div>

      {/* Specification Binding Header */}
      {selectedSubject?.specification_id ? (
        <div className="bg-stone-50 border border-stone-200/80 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-stone-500 shrink-0" />
            <span>
              Bound Specification:{' '}
              <strong className="text-stone-900 font-semibold">
                {prioritiesReport?.specification_name || 'Pearson Edexcel GCSE Mathematics (1MA1)'}
              </strong>
            </span>
          </div>
          <span className="text-2xs text-stone-400 font-mono hidden sm:inline">
            Total Objectives: {prioritiesReport?.total_priorities || 0}
          </span>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>This subject is not currently bound to an official GCSE specification. Select a bound subject to inspect curriculum priorities.</span>
        </div>
      )}

      {/* Metrics Summary Strip */}
      {prioritiesReport && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => setActiveTab('remediation')}
            className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
              activeTab === 'remediation'
                ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold text-rose-800">Critical & Direct Gaps</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-xl font-bold text-stone-900 mt-1">
              {(prioritiesReport.tier_1_count || 0) + (prioritiesReport.tier_2_count || 0)}
            </p>
            <span className="text-2xs text-stone-400">Immediate remediation</span>
          </div>

          <div
            onClick={() => setActiveTab('diagnostic')}
            className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
              activeTab === 'diagnostic'
                ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-500/20'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold text-sky-800">Diagnostic Checks</span>
              <Compass className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-xl font-bold text-stone-900 mt-1">
              {prioritiesReport.tier_4_count || 0}
            </p>
            <span className="text-2xs text-stone-400">Unassessed baseline</span>
          </div>

          <div
            onClick={() => setActiveTab('blocked')}
            className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
              activeTab === 'blocked'
                ? 'bg-stone-100 border-stone-300 ring-2 ring-stone-400/20'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold text-stone-700">Blocked by Prerequisites</span>
              <Lock className="w-4 h-4 text-stone-600" />
            </div>
            <p className="text-xl font-bold text-stone-900 mt-1">
              {prioritiesReport.tier_3_count || 0}
            </p>
            <span className="text-2xs text-stone-400">Deferred topics</span>
          </div>

          <div
            onClick={() => setActiveTab('ontrack')}
            className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
              activeTab === 'ontrack'
                ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold text-emerald-800">On Track & Mastered</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-stone-900 mt-1">
              {(prioritiesReport.tier_5_count || 0) + (prioritiesReport.tier_6_count || 0)}
            </p>
            <span className="text-2xs text-stone-400">Progression ready</span>
          </div>
        </div>
      )}

      {/* Filter Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('focus')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === 'focus'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Top Focus (Top 3–5)
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === 'all'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          All Priorities
        </button>
        <button
          onClick={() => setActiveTab('remediation')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === 'remediation'
              ? 'bg-rose-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Remediation (Tier 1 & 2)
        </button>
        <button
          onClick={() => setActiveTab('diagnostic')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === 'diagnostic'
              ? 'bg-sky-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Diagnostic Checks (Tier 4)
        </button>
        <button
          onClick={() => setActiveTab('blocked')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === 'blocked'
              ? 'bg-stone-800 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Prerequisite Blockers (Tier 3)
        </button>
        <button
          onClick={() => setActiveTab('ontrack')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === 'ontrack'
              ? 'bg-emerald-800 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          On Track (Tier 5 & 6)
        </button>
        <button
          onClick={() => setActiveTab('excluded')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === 'excluded'
              ? 'bg-stone-700 text-white'
              : 'text-stone-500 hover:bg-stone-100'
          }`}
        >
          Excluded
        </button>
      </div>

      {/* Main Priority Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-stone-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-600" />
          <p className="text-sm font-medium">Calculating deterministic learning priorities...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center text-rose-800 text-sm">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : displayedPriorities.length === 0 ? (
        <div className="p-12 text-center bg-stone-50 border border-stone-200 rounded-xl text-stone-500 text-sm">
          <CheckCircle2 className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="font-semibold text-stone-700">No priorities matching the current filter</p>
          <p className="text-xs mt-1">Switch to "Top Focus" or "All Priorities" to view curriculum items.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <span>
              Showing <strong>{displayedPriorities.length}</strong> priority item(s)
            </span>
            <span className="font-mono text-2xs text-stone-400">
              Deterministic Tie-Breaking Engine
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedPriorities.map((priority) => (
              <PriorityCard
                key={priority.learning_objective_id}
                priority={priority}
                decision={decisionMap.get(priority.learning_objective_id)}
                onInspect={(p) => setInspectPriority(p)}
                onApprove={(p) => handleQuickApprove(p)}
                onDefer={(p) => openDecisionModal(p, 'DEFERRED')}
                onOverride={(p) => openDecisionModal(p, 'OVERRIDDEN')}
                onExclude={(p) => openDecisionModal(p, 'EXCLUDED')}
                onViewHistory={(p) => openHistory(p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inspect / Why Modal */}
      <PriorityInspectModal
        isOpen={Boolean(inspectPriority)}
        onClose={() => setInspectPriority(null)}
        priority={inspectPriority}
        decision={inspectPriority ? decisionMap.get(inspectPriority.learning_objective_id) : undefined}
        onViewHistory={() => {
          if (inspectPriority) {
            openHistory(inspectPriority);
          }
        }}
      />

      {/* Decision Action Modal (Defer, Override, Exclude) */}
      <DecisionActionModal
        isOpen={Boolean(decisionModalPriority)}
        onClose={() => setDecisionModalPriority(null)}
        priority={decisionModalPriority}
        actionType={decisionModalAction}
        onSaveDecision={handleSaveModalDecision}
      />

      {/* Immutable Decision History Drawer */}
      <DecisionHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => {
          setIsHistoryDrawerOpen(false);
          setHistoryDrawerPriority(null);
        }}
        studentId={selectedStudent?.id || ''}
        priority={historyDrawerPriority}
      />
    </div>
  );
};
