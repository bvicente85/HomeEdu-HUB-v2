import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Student,
  StudentSubject,
  LearningObjective,
  StudentLearningState,
  LearningEvidence,
  LearningStateHistory,
  DiagnosticSession,
  DiagnosticTarget,
  MasteryState,
  GapStatus,
  ConfidenceLevel,
} from '../types/database';
import { curriculumService } from '../lib/curriculumService';
import { learningStateService } from '../lib/learningStateService';
import { ParentOverrideModal } from './ParentOverrideModal';
import { DiagnosticSessionModal } from './DiagnosticSessionModal';
import { DiagnosticRunner } from './DiagnosticRunner';
import { DiagnosticResultsModal } from './DiagnosticResultsModal';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  History as HistoryIcon,
  FileText,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  ClipboardList,
  Sparkles,
  Info,
  Clock,
  Plus,
} from 'lucide-react';

interface LearningStateViewProps {
  student: Student | null;
  allStudents: Student[];
  subjects: StudentSubject[];
  userRole: 'parent' | 'student';
  onSelectStudent?: (student: Student) => void;
}

export const LearningStateView: React.FC<LearningStateViewProps> = ({
  student,
  allStudents,
  subjects,
  userRole,
  onSelectStudent,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'objectives' | 'diagnostics'>('objectives');
  const [loading, setLoading] = useState(false);

  // Curriculum specification details for the selected subject
  const [availableObjectives, setAvailableObjectives] = useState<
    (LearningObjective & { conceptTitle?: string; topicTitle?: string })[]
  >([]);

  // Student Learning Data
  const [learningStates, setLearningStates] = useState<StudentLearningState[]>([]);
  const [evidenceList, setEvidenceList] = useState<LearningEvidence[]>([]);
  const [diagnosticSessions, setDiagnosticSessions] = useState<DiagnosticSession[]>([]);

  // Inspection Drawer
  const [inspectedObjectiveId, setInspectedObjectiveId] = useState<string | null>(null);
  const [inspectedHistory, setInspectedHistory] = useState<LearningStateHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modals & Runner
  const [overrideModalLo, setOverrideModalLo] = useState<LearningObjective | null>(null);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [activeRunnerSessionId, setActiveRunnerSessionId] = useState<string | null>(null);
  const [inspectedResultsSessionId, setInspectedResultsSessionId] = useState<string | null>(null);

  // Auto-select first subject
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  // Load curriculum objectives for the active subject
  const loadCurriculumData = useCallback(async () => {
    if (!activeSubject) {
      setAvailableObjectives([]);
      return;
    }

    // Require explicit specification_id binding - NO fallbacks or fuzzy matching
    if (!activeSubject.specification_id) {
      setAvailableObjectives([]);
      setInspectedObjectiveId(null);
      return;
    }

    try {
      const detail = await curriculumService.getSpecificationDetail(activeSubject.specification_id);
      if (detail) {
        const loAccumulator: (LearningObjective & {
          conceptTitle?: string;
          topicTitle?: string;
        })[] = [];

        detail.topics.forEach((t) => {
          t.concepts.forEach((c) => {
            c.learning_objectives.forEach((lo) => {
              loAccumulator.push({
                ...lo,
                conceptTitle: c.title,
                topicTitle: t.title,
              });
            });
          });
        });

        setAvailableObjectives(loAccumulator);
        if (loAccumulator.length > 0 && !inspectedObjectiveId) {
          setInspectedObjectiveId(loAccumulator[0].id);
        }
      } else {
        setAvailableObjectives([]);
        setInspectedObjectiveId(null);
      }
    } catch (err) {
      console.error('Failed to load curriculum objectives for subject:', err);
      setAvailableObjectives([]);
      setInspectedObjectiveId(null);
    }
  }, [activeSubject, inspectedObjectiveId]);

  // Load student learning state records & evidence
  const loadStudentLearningData = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    try {
      const [states, evList, sessions] = await Promise.all([
        learningStateService.getLearningStatesForStudent(student.id),
        learningStateService.getEvidenceForStudent(student.id),
        learningStateService.getDiagnosticSessions(student.id),
      ]);
      setLearningStates(states);
      setEvidenceList(evList);
      setDiagnosticSessions(sessions);
    } catch (err) {
      console.error('Failed to load learning state data:', err);
    } finally {
      setLoading(false);
    }
  }, [student]);

  useEffect(() => {
    loadCurriculumData();
  }, [loadCurriculumData]);

  useEffect(() => {
    loadStudentLearningData();
  }, [loadStudentLearningData]);

  // Load history when inspected objective changes
  useEffect(() => {
    if (!student || !inspectedObjectiveId) {
      setInspectedHistory([]);
      return;
    }
    setLoadingHistory(true);
    learningStateService
      .getHistoryForObjective(student.id, inspectedObjectiveId)
      .then(setInspectedHistory)
      .catch((err) => console.error('Failed to load history:', err))
      .finally(() => setLoadingHistory(false));
  }, [student, inspectedObjectiveId]);

  // Derived state maps for fast O(1) lookups
  const stateByLoId = useMemo(() => {
    const map = new Map<string, StudentLearningState>();
    learningStates.forEach((s) => map.set(s.learning_objective_id, s));
    return map;
  }, [learningStates]);

  const evidenceByLoId = useMemo(() => {
    const map = new Map<string, LearningEvidence[]>();
    evidenceList.forEach((e) => {
      const list = map.get(e.learning_objective_id) || [];
      list.push(e);
      map.set(e.learning_objective_id, list);
    });
    return map;
  }, [evidenceList]);

  // Summary counts
  const summary = useMemo(() => {
    let notAssessed = 0;
    let emerging = 0;
    let developing = 0;
    let secure = 0;
    let mastered = 0;
    let gaps = 0;
    let prereqGaps = 0;

    availableObjectives.forEach((lo) => {
      const st = stateByLoId.get(lo.id);
      const mastery = st?.mastery_state || 'NOT_ASSESSED';
      const gap = st?.gap_status || 'NO_DATA';

      if (mastery === 'NOT_ASSESSED') notAssessed++;
      else if (mastery === 'EMERGING') emerging++;
      else if (mastery === 'DEVELOPING') developing++;
      else if (mastery === 'SECURE') secure++;
      else if (mastery === 'MASTERED') mastered++;

      if (gap === 'GAP') gaps++;
      if (gap === 'PREREQUISITE_GAP') prereqGaps++;
    });

    return {
      total: availableObjectives.length,
      notAssessed,
      emerging,
      developing,
      secure,
      mastered,
      gaps,
      prereqGaps,
    };
  }, [availableObjectives, stateByLoId]);

  const inspectedLo = useMemo(
    () => availableObjectives.find((lo) => lo.id === inspectedObjectiveId) || null,
    [availableObjectives, inspectedObjectiveId]
  );

  const inspectedState = inspectedLo ? stateByLoId.get(inspectedLo.id) || null : null;
  const inspectedEvidence = inspectedLo ? evidenceByLoId.get(inspectedLo.id) || [] : [];

  const handleRecordOverrideSave = async (params: {
    newMasteryState: MasteryState;
    newGapStatus: GapStatus;
    confidenceLevel: ConfidenceLevel;
    notes: string;
  }) => {
    if (!student || !overrideModalLo) return;
    await learningStateService.recordParentOverride({
      studentId: student.id,
      learningObjectiveId: overrideModalLo.id,
      ...params,
    });
    await loadStudentLearningData();
    if (inspectedObjectiveId === overrideModalLo.id) {
      const hist = await learningStateService.getHistoryForObjective(
        student.id,
        overrideModalLo.id
      );
      setInspectedHistory(hist);
    }
  };

  const handleCreateDiagnosticSession = async (params: {
    title: string;
    purpose: string;
    selectedObjectiveIds: string[];
  }) => {
    if (!student) return;
    await learningStateService.createDiagnosticSession({
      studentId: student.id,
      studentSubjectId: activeSubject?.id,
      specificationId: activeSubject?.specification_id || undefined,
      title: params.title,
      purpose: params.purpose,
      targetObjectives: params.selectedObjectiveIds.map((loId) => ({
        learningObjectiveId: loId,
      })),
    });
    const sessions = await learningStateService.getDiagnosticSessions(student.id);
    setDiagnosticSessions(sessions);
  };

  if (!student) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-stone-500">
        <AlertTriangle className="w-8 h-8 text-stone-400 mx-auto mb-2" />
        <p className="text-sm font-medium">Please select a student to view learning states.</p>
      </div>
    );
  }

  if (activeRunnerSessionId) {
    return (
      <DiagnosticRunner
        student={student}
        sessionId={activeRunnerSessionId}
        onExit={() => setActiveRunnerSessionId(null)}
        onSessionCompleted={() => {
          loadStudentLearningData();
          loadCurriculumData();
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Student Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-500">
              Phase 2B Baseline & Diagnostic Ledger
            </span>
            <span className="bg-stone-100 text-stone-700 text-2xs px-2 py-0.5 rounded font-mono font-medium">
              Household Isolation Verified
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
            Student Learning State
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Decoupled categorical mastery, prerequisite gap tracking, and evidence reliability for{' '}
            <strong>{student.first_name}</strong>.
          </p>
        </div>

        {/* Student Selector (for multiple children) */}
        {allStudents.length > 1 && onSelectStudent && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-medium">Inspecting:</span>
            <select
              value={student.id}
              onChange={(e) => {
                const target = allStudents.find((s) => s.id === e.target.value);
                if (target) onSelectStudent(target);
              }}
              className="text-xs px-3 py-1.5 border border-stone-300 rounded bg-white font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} ({s.year_group})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Subject Filter & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-stone-500 shrink-0" />
          <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
            Subject:
          </span>
          {subjects.length > 0 ? (
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="text-xs px-3 py-1.5 border border-stone-300 rounded bg-stone-50 font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.subject_name} — {sub.exam_board} ({sub.qualification})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-stone-500 italic">No enrolled subjects registered</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('objectives')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'objectives'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Learning Objectives ({availableObjectives.length})
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'diagnostics'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Diagnostic Sessions ({diagnosticSessions.length})
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-stone-200 shadow-2xs">
          <span className="text-2xs text-stone-400 uppercase tracking-wider font-semibold block">
            Not Assessed
          </span>
          <span className="text-xl font-bold text-stone-700 mt-1 block">
            {summary.notAssessed}
          </span>
          <span className="text-2xs text-stone-400">Baseline unestablished</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-stone-200 shadow-2xs">
          <span className="text-2xs text-amber-600 uppercase tracking-wider font-semibold block">
            Emerging
          </span>
          <span className="text-xl font-bold text-amber-700 mt-1 block">{summary.emerging}</span>
          <span className="text-2xs text-amber-600">Assisted / Inconsistent</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-stone-200 shadow-2xs">
          <span className="text-2xs text-sky-600 uppercase tracking-wider font-semibold block">
            Developing
          </span>
          <span className="text-xl font-bold text-sky-700 mt-1 block">{summary.developing}</span>
          <span className="text-2xs text-sky-600">Partial independent</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-stone-200 shadow-2xs">
          <span className="text-2xs text-emerald-600 uppercase tracking-wider font-semibold block">
            Secure
          </span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">{summary.secure}</span>
          <span className="text-2xs text-emerald-600">Verified independent</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-stone-200 shadow-2xs">
          <span className="text-2xs text-indigo-600 uppercase tracking-wider font-semibold block">
            Mastered
          </span>
          <span className="text-xl font-bold text-indigo-700 mt-1 block">{summary.mastered}</span>
          <span className="text-2xs text-indigo-600">Contextual transfer</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-stone-200 shadow-2xs">
          <span className="text-2xs text-rose-600 uppercase tracking-wider font-semibold block">
            Gaps Detected
          </span>
          <span className="text-xl font-bold text-rose-700 mt-1 block">
            {summary.gaps + summary.prereqGaps}
          </span>
          <span className="text-2xs text-rose-600">
            {summary.prereqGaps > 0 ? `${summary.prereqGaps} prerequisite blocking` : 'Direct gaps'}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {!activeSubject?.specification_id ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center space-y-3 shadow-2xs">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-amber-900">
            Curriculum Specification Not Configured
          </h3>
          <p className="text-xs text-amber-800 max-w-lg mx-auto">
            This subject (<strong>{activeSubject?.subject_name}</strong> - {activeSubject?.exam_board}) does not have an explicit curriculum specification bound. Diagnostic sessions and learning objective ledgers require an authoritative specification binding.
          </p>
          <div className="text-2xs text-amber-700 bg-amber-100/80 p-3 rounded max-w-md mx-auto border border-amber-200">
            <strong>Active Vertical Slice:</strong> Pearson Edexcel GCSE (9-1) Mathematics (1MA1). Select Mathematics in the subject bar above to inspect verified diagnostic objectives.
          </div>
        </div>
      ) : activeTab === 'objectives' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Objectives Master List */}
          <div className="lg:col-span-7 bg-white rounded-lg border border-stone-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                  Curriculum Objectives & Diagnostic Status
                </h3>
                <span className="text-2xs text-stone-500">
                  Select an objective to inspect its evidence ledger and state transition history.
                </span>
              </div>
              <span className="text-2xs font-mono font-medium text-stone-400">
                {availableObjectives.length} total
              </span>
            </div>

            <div className="divide-y divide-stone-100 max-h-[640px] overflow-y-auto">
              {availableObjectives.map((lo) => {
                const st = stateByLoId.get(lo.id);
                const isInspected = lo.id === inspectedObjectiveId;
                const mastery = st?.mastery_state || 'NOT_ASSESSED';
                const gap = st?.gap_status || 'NO_DATA';
                const evidenceCount = st?.evidence_count || 0;

                return (
                  <div
                    key={lo.id}
                    onClick={() => setInspectedObjectiveId(lo.id)}
                    className={`p-3.5 cursor-pointer transition-colors flex items-start gap-3 hover:bg-stone-50 ${
                      isInspected ? 'bg-stone-100/70 border-l-3 border-stone-900' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-2xs font-semibold px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded">
                          {lo.code}
                        </span>

                        {/* Mastery State Badge */}
                        <span
                          className={`text-2xs font-medium px-2 py-0.5 rounded ${
                            mastery === 'MASTERED'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : mastery === 'SECURE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : mastery === 'DEVELOPING'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : mastery === 'EMERGING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-stone-100 text-stone-500 border border-stone-200'
                          }`}
                        >
                          {mastery.replace('_', ' ')}
                        </span>

                        {/* Gap Status Badge */}
                        {gap !== 'NO_DATA' && gap !== 'ON_TRACK' && (
                          <span
                            className={`text-2xs font-medium px-2 py-0.5 rounded ${
                              gap === 'PREREQUISITE_GAP'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {gap.replace('_', ' ')}
                          </span>
                        )}

                        <span className="text-2xs text-stone-400 font-mono">
                          Tier: {lo.tier_eligibility}
                        </span>
                      </div>

                      <p className="text-xs text-stone-800 leading-snug line-clamp-2">
                        {lo.statement}
                      </p>

                      <div className="flex items-center gap-3 text-2xs text-stone-400 mt-2">
                        <span>Concept: {lo.conceptTitle || 'General'}</span>
                        <span>•</span>
                        <span>Evidence: {evidenceCount} items</span>
                        {st?.last_assessed_at && (
                          <>
                            <span>•</span>
                            <span>Assessed: {new Date(st.last_assessed_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 shrink-0 mt-1 transition-transform ${
                        isInspected ? 'text-stone-900 translate-x-0.5' : 'text-stone-300'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Inspection Drawer */}
          <div className="lg:col-span-5 space-y-4">
            {inspectedLo ? (
              <div className="bg-white rounded-lg border border-stone-200 shadow-2xs p-5 space-y-5">
                {/* Header & Parent Override Button */}
                <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <span className="font-mono text-xs font-semibold text-stone-600 block">
                      {inspectedLo.code}
                    </span>
                    <h3 className="text-sm font-semibold text-stone-900 mt-0.5 leading-snug">
                      {inspectedLo.statement}
                    </h3>
                  </div>

                  {userRole === 'parent' && (
                    <button
                      onClick={() => setOverrideModalLo(inspectedLo)}
                      className="px-2.5 py-1 text-2xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                      title="Manually record a validated parent observation or diagnostic override"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Parent Override</span>
                    </button>
                  )}
                </div>

                {/* State Card */}
                <div className="bg-stone-50/80 border border-stone-200/90 rounded-md p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold text-stone-500 uppercase tracking-wider">
                      Current Mastery
                    </span>
                    <span className="font-semibold text-stone-900">
                      {inspectedState?.mastery_state || 'NOT_ASSESSED'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold text-stone-500 uppercase tracking-wider">
                      Gap Dimension
                    </span>
                    <span
                      className={`font-semibold ${
                        inspectedState?.gap_status === 'PREREQUISITE_GAP'
                          ? 'text-purple-700'
                          : inspectedState?.gap_status === 'GAP'
                          ? 'text-rose-700'
                          : 'text-stone-700'
                      }`}
                    >
                      {inspectedState?.gap_status || 'NO_DATA'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold text-stone-500 uppercase tracking-wider">
                      Evidence Reliability
                    </span>
                    <span className="font-semibold text-stone-700">
                      {inspectedState?.confidence_level || 'LOW'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold text-stone-500 uppercase tracking-wider">
                      Evidence Count
                    </span>
                    <span className="font-mono text-stone-700 font-medium">
                      {inspectedState?.evidence_count || 0}
                    </span>
                  </div>

                  {inspectedState?.notes && (
                    <div className="pt-2 border-t border-stone-200/70 text-stone-600">
                      <span className="text-2xs font-semibold text-stone-500 block mb-0.5">
                        Clinical/Assessment Notes:
                      </span>
                      <p className="italic text-2xs leading-relaxed">{inspectedState.notes}</p>
                    </div>
                  )}
                </div>

                {/* Evidence Ledger Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-stone-500" />
                      <span>Evidence Ledger ({inspectedEvidence.length})</span>
                    </h4>
                  </div>

                  {inspectedEvidence.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {inspectedEvidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-2.5 bg-white border border-stone-200 rounded text-xs space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-2xs font-semibold text-stone-600">
                              {ev.evidence_type}
                            </span>
                            <span className="text-2xs text-stone-400">
                              {new Date(ev.captured_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-2xs text-stone-500">
                            <span>Status: {ev.result_status}</span>
                            <span>•</span>
                            <span>Support: {ev.support_level}</span>
                            <span>•</span>
                            <span>Reliability: {ev.reliability}</span>
                          </div>
                          {ev.notes && <p className="text-2xs text-stone-700 italic">{ev.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-stone-50 border border-dashed border-stone-200 rounded text-center text-xs text-stone-400">
                      No empirical evidence recorded yet for this objective.
                    </div>
                  )}
                </div>

                {/* State History Ledger Section */}
                <div className="space-y-2.5 pt-2 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <HistoryIcon className="w-3.5 h-3.5 text-stone-500" />
                      <span>State Transition History</span>
                    </h4>
                    {loadingHistory && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
                  </div>

                  {inspectedHistory.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {inspectedHistory.map((hist) => (
                        <div
                          key={hist.id}
                          className="p-2.5 bg-stone-50/70 border border-stone-200/80 rounded text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-stone-800 text-2xs">
                              {hist.previous_mastery_state || 'NONE'} →{' '}
                              <strong>{hist.new_mastery_state}</strong>
                            </span>
                            <span className="text-2xs text-stone-400 font-mono">
                              {new Date(hist.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-2xs text-stone-500">
                            <span>Reason: {hist.change_reason}</span>
                            <span>•</span>
                            <span>Gap: {hist.new_gap_status}</span>
                          </div>
                          {hist.notes && (
                            <p className="text-2xs text-stone-600 italic">“{hist.notes}”</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-stone-50 border border-dashed border-stone-200 rounded text-center text-xs text-stone-400">
                      No historical state revisions recorded.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-8 text-center text-stone-400 text-xs">
                Select an objective from the left list to inspect its learning state and audit history.
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'diagnostics' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-stone-200">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                Diagnostic Assessment Sessions
              </h3>
              <p className="text-xs text-stone-500">
                Deliberate diagnostic baselines for {student.first_name} to systematically verify
                prerequisites.
              </p>
            </div>
            {userRole === 'parent' && (
              <button
                onClick={() => setIsDiagnosticModalOpen(true)}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Plan Diagnostic Session</span>
              </button>
            )}
          </div>

          {diagnosticSessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {diagnosticSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="bg-white p-5 rounded-lg border border-stone-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-2xs font-semibold uppercase tracking-wider text-stone-400 block">
                        Diagnostic Session
                      </span>
                      <h4 className="text-sm font-semibold text-stone-900">{sess.title}</h4>
                    </div>
                    <span
                      className={`text-2xs px-2 py-0.5 rounded font-medium ${
                        sess.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : sess.status === 'IN_PROGRESS'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : sess.status === 'CANCELLED'
                          ? 'bg-stone-100 text-stone-500'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {sess.status}
                    </span>
                  </div>

                  {sess.purpose && (
                    <p className="text-xs text-stone-600 italic bg-stone-50 p-2.5 rounded border border-stone-100">
                      {sess.purpose}
                    </p>
                  )}

                  <div className="pt-3 flex items-center justify-between border-t border-stone-100 flex-wrap gap-2">
                    <div className="flex items-center gap-3 text-2xs text-stone-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created: {new Date(sess.created_at).toLocaleDateString()}
                      </span>
                      {sess.completed_at && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed: {new Date(sess.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {sess.status === 'COMPLETED' ? (
                      <button
                        onClick={() => setInspectedResultsSessionId(sess.id)}
                        className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-2xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>View Audit Results</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveRunnerSessionId(sess.id)}
                        className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded text-2xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <span>{sess.status === 'IN_PROGRESS' ? 'Resume Assessment' : 'Start Assessment'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-10 rounded-lg border border-dashed border-stone-300 text-center space-y-3">
              <ClipboardList className="w-8 h-8 text-stone-400 mx-auto" />
              <div>
                <h4 className="text-sm font-semibold text-stone-800">
                  No Diagnostic Sessions Planned Yet
                </h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                  Establish an initial curriculum baseline by planning a diagnostic session for{' '}
                  <strong>{student.first_name}</strong>.
                </p>
              </div>
              {userRole === 'parent' && (
                <button
                  onClick={() => setIsDiagnosticModalOpen(true)}
                  className="px-3.5 py-1.5 bg-stone-900 text-white rounded text-xs font-semibold hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Plan First Diagnostic Session</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Parent Override Modal */}
      {overrideModalLo && (
        <ParentOverrideModal
          isOpen={Boolean(overrideModalLo)}
          objective={overrideModalLo}
          currentState={stateByLoId.get(overrideModalLo.id)}
          studentName={student.first_name}
          onClose={() => setOverrideModalLo(null)}
          onSave={handleRecordOverrideSave}
        />
      )}

      {/* Diagnostic Session Planner Modal */}
      {isDiagnosticModalOpen && activeSubject && (
        <DiagnosticSessionModal
          isOpen={isDiagnosticModalOpen}
          student={student}
          subject={activeSubject}
          availableObjectives={availableObjectives}
          onClose={() => setIsDiagnosticModalOpen(false)}
          onCreated={async () => {
            const sessions = await learningStateService.getDiagnosticSessions(student.id);
            setDiagnosticSessions(sessions);
          }}
        />
      )}

      {/* Diagnostic Results Modal */}
      {inspectedResultsSessionId && (
        <DiagnosticResultsModal
          isOpen={Boolean(inspectedResultsSessionId)}
          student={student}
          sessionId={inspectedResultsSessionId}
          onClose={() => setInspectedResultsSessionId(null)}
        />
      )}
    </div>
  );
};
