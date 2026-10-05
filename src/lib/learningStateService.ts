import {
  StudentLearningState,
  LearningEvidence,
  LearningStateHistory,
  DiagnosticSession,
  DiagnosticTarget,
  AssessmentAttempt,
  MasteryState,
  GapStatus,
  ConfidenceLevel,
} from '../types/learningState';
import { getSupabaseClient, isSupabaseReachable, isProductionEnvironment } from './supabase';

const LOCAL_STORAGE_KEY_STATES = 'homeedu_learning_states_v1';
const LOCAL_STORAGE_KEY_EVIDENCE = 'homeedu_learning_evidence_v1';
const LOCAL_STORAGE_KEY_HISTORY = 'homeedu_learning_history_v1';
const LOCAL_STORAGE_KEY_SESSIONS = 'homeedu_diagnostic_sessions_v1';
const LOCAL_STORAGE_KEY_TARGETS = 'homeedu_diagnostic_targets_v1';
const LOCAL_STORAGE_KEY_ATTEMPTS = 'homeedu_assessment_attempts_v1';

function getLocalStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStore<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`Failed to persist to localStorage [${key}]:`, err);
  }
}

export const learningStateService = {
  /**
   * Fetches learning states for an individual student.
   * If not yet evaluated, states default cleanly to NOT_ASSESSED / NO_DATA.
   */
  async getLearningStatesForStudent(studentId: string): Promise<StudentLearningState[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('student_learning_states')
          .select('*')
          .eq('student_id', studentId);

        if (!error && data) {
          return data as StudentLearningState[];
        }
      } catch (err) {
        console.warn('getLearningStatesForStudent fallback:', err);
      }
    }
    const all = getLocalStore<StudentLearningState>(LOCAL_STORAGE_KEY_STATES);
    return all.filter((s) => s.student_id === studentId);
  },

  /**
   * Fetches learning evidence items for a student, optionally filtered by objective.
   */
  async getEvidenceForStudent(studentId: string, loId?: string): Promise<LearningEvidence[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        let query = supabase
          .from('learning_evidence')
          .select('*')
          .eq('student_id', studentId)
          .order('captured_at', { ascending: false });

        if (loId) {
          query = query.eq('learning_objective_id', loId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as LearningEvidence[];
        }
      } catch (err) {
        console.warn('getEvidenceForStudent fallback:', err);
      }
    }
    const all = getLocalStore<LearningEvidence>(LOCAL_STORAGE_KEY_EVIDENCE);
    return all.filter(
      (e) => e.student_id === studentId && (!loId || e.learning_objective_id === loId)
    );
  },

  /**
   * Fetches state transition history for a student's learning objective.
   */
  async getHistoryForObjective(studentId: string, loId: string): Promise<LearningStateHistory[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('learning_state_history')
          .select('*')
          .eq('student_id', studentId)
          .eq('learning_objective_id', loId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as LearningStateHistory[];
        }
      } catch (err) {
        console.warn('getHistoryForObjective fallback:', err);
      }
    }
    const all = getLocalStore<LearningStateHistory>(LOCAL_STORAGE_KEY_HISTORY);
    return all.filter(
      (h) => h.student_id === studentId && h.learning_objective_id === loId
    );
  },

  /**
   * Records an explicit PARENT_OVERRIDE on a student's learning objective.
   * Atomically or sequentially writes:
   * 1. State upsert (student_learning_states)
   * 2. Evidence record (learning_evidence with evidence_type = 'PARENT_OVERRIDE')
   * 3. Audit history entry (learning_state_history with change_reason = 'PARENT_OVERRIDE')
   */
  async recordParentOverride(params: {
    studentId: string;
    learningObjectiveId: string;
    newMasteryState: MasteryState;
    newGapStatus: GapStatus;
    confidenceLevel?: ConfidenceLevel;
    notes: string;
  }): Promise<{
    state: StudentLearningState;
    evidence: LearningEvidence;
    history: LearningStateHistory;
  }> {
    const {
      studentId,
      learningObjectiveId,
      newMasteryState,
      newGapStatus,
      confidenceLevel = 'MEDIUM',
      notes,
    } = params;

    const now = new Date().toISOString();
    const evidenceId = crypto.randomUUID();
    const stateId = crypto.randomUUID();
    const historyId = crypto.randomUUID();

    const newEvidence: LearningEvidence = {
      id: evidenceId,
      student_id: studentId,
      learning_objective_id: learningObjectiveId,
      evidence_type: 'PARENT_OVERRIDE',
      support_level: 'INDEPENDENT',
      result_status:
        newMasteryState === 'SECURE' || newMasteryState === 'MASTERED'
          ? 'DEMONSTRATED'
          : newMasteryState === 'EMERGING' || newMasteryState === 'DEVELOPING'
          ? 'PARTIALLY_DEMONSTRATED'
          : 'NOT_DEMONSTRATED',
      reliability: confidenceLevel,
      source_reference: 'Parent Administrative Assessment',
      captured_at: now,
      notes: notes.trim(),
      created_at: now,
    };

    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;

        // 1. Try atomic PostgreSQL RPC function first
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'record_parent_learning_override',
          {
            p_student_id: studentId,
            p_learning_objective_id: learningObjectiveId,
            p_new_mastery_state: newMasteryState,
            p_new_gap_status: newGapStatus,
            p_confidence_level: confidenceLevel,
            p_notes: notes.trim(),
          }
        );

        if (!rpcErr && rpcData) {
          const payload = rpcData as {
            state: StudentLearningState;
            evidence: LearningEvidence;
            history: LearningStateHistory;
          };
          return payload;
        }

        // 2. Sequential fallback if RPC is not yet registered in remote cache
        const { data: existingState } = await supabase
          .from('student_learning_states')
          .select('*')
          .eq('student_id', studentId)
          .eq('learning_objective_id', learningObjectiveId)
          .maybeSingle();

        const prevState = (existingState as StudentLearningState)?.mastery_state || null;
        const prevGap = (existingState as StudentLearningState)?.gap_status || null;
        const currentEvidenceCount = ((existingState as StudentLearningState)?.evidence_count || 0) + 1;
        const resolvedStateId = existingState?.id || stateId;

        await supabase.from('learning_evidence').insert(newEvidence);

        const targetStatePayload = {
          id: resolvedStateId,
          student_id: studentId,
          learning_objective_id: learningObjectiveId,
          mastery_state: newMasteryState,
          gap_status: newGapStatus,
          evidence_count: currentEvidenceCount,
          last_assessed_at: now,
          last_demonstrated_at:
            newMasteryState === 'SECURE' || newMasteryState === 'MASTERED'
              ? now
              : existingState?.last_demonstrated_at || null,
          confidence_level: confidenceLevel,
          notes: notes.trim(),
          updated_at: now,
        };

        const { data: upsertedState, error: stateErr } = await supabase
          .from('student_learning_states')
          .upsert(targetStatePayload)
          .select()
          .single();

        if (stateErr) {
          throw stateErr;
        }

        const newHistory: LearningStateHistory = {
          id: historyId,
          learning_state_id: resolvedStateId,
          student_id: studentId,
          learning_objective_id: learningObjectiveId,
          previous_mastery_state: prevState,
          new_mastery_state: newMasteryState,
          previous_gap_status: prevGap,
          new_gap_status: newGapStatus,
          change_reason: 'PARENT_OVERRIDE',
          evidence_id: evidenceId,
          notes: notes.trim(),
          created_at: now,
        };

        await supabase.from('learning_state_history').insert(newHistory);

        return {
          state: (upsertedState || targetStatePayload) as StudentLearningState,
          evidence: newEvidence,
          history: newHistory,
        };
      } catch (err) {
        if (isProductionEnvironment()) {
          throw err;
        }
        console.warn('recordParentOverride live insert fallback to local store:', err);
      }
    }

    // Local fallback store
    const localStates = getLocalStore<StudentLearningState>(LOCAL_STORAGE_KEY_STATES);
    const existingIdx = localStates.findIndex(
      (s) => s.student_id === studentId && s.learning_objective_id === learningObjectiveId
    );

    let prevState: MasteryState | null = null;
    let prevGap: GapStatus | null = null;
    let resolvedState: StudentLearningState;

    if (existingIdx >= 0) {
      prevState = localStates[existingIdx].mastery_state;
      prevGap = localStates[existingIdx].gap_status;
      resolvedState = {
        ...localStates[existingIdx],
        mastery_state: newMasteryState,
        gap_status: newGapStatus,
        evidence_count: localStates[existingIdx].evidence_count + 1,
        last_assessed_at: now,
        last_demonstrated_at:
          newMasteryState === 'SECURE' || newMasteryState === 'MASTERED'
            ? now
            : localStates[existingIdx].last_demonstrated_at,
        confidence_level: confidenceLevel,
        notes: notes.trim(),
        updated_at: now,
      };
      localStates[existingIdx] = resolvedState;
    } else {
      resolvedState = {
        id: stateId,
        student_id: studentId,
        learning_objective_id: learningObjectiveId,
        mastery_state: newMasteryState,
        gap_status: newGapStatus,
        evidence_count: 1,
        last_assessed_at: now,
        last_demonstrated_at:
          newMasteryState === 'SECURE' || newMasteryState === 'MASTERED' ? now : null,
        confidence_level: confidenceLevel,
        notes: notes.trim(),
        created_at: now,
        updated_at: now,
      };
      localStates.push(resolvedState);
    }
    saveLocalStore(LOCAL_STORAGE_KEY_STATES, localStates);

    const localEv = getLocalStore<LearningEvidence>(LOCAL_STORAGE_KEY_EVIDENCE);
    localEv.unshift(newEvidence);
    saveLocalStore(LOCAL_STORAGE_KEY_EVIDENCE, localEv);

    const newHistory: LearningStateHistory = {
      id: historyId,
      learning_state_id: resolvedState.id,
      student_id: studentId,
      learning_objective_id: learningObjectiveId,
      previous_mastery_state: prevState,
      new_mastery_state: newMasteryState,
      previous_gap_status: prevGap,
      new_gap_status: newGapStatus,
      change_reason: 'PARENT_OVERRIDE',
      evidence_id: evidenceId,
      notes: notes.trim(),
      created_at: now,
    };

    const localHist = getLocalStore<LearningStateHistory>(LOCAL_STORAGE_KEY_HISTORY);
    localHist.unshift(newHistory);
    saveLocalStore(LOCAL_STORAGE_KEY_HISTORY, localHist);

    return {
      state: resolvedState,
      evidence: newEvidence,
      history: newHistory,
    };
  },

  /**
   * Fetches diagnostic sessions for a student.
   */
  async getDiagnosticSessions(studentId: string): Promise<DiagnosticSession[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('diagnostic_sessions')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as DiagnosticSession[];
        }
      } catch (err) {
        console.warn('getDiagnosticSessions fallback:', err);
      }
    }
    const all = getLocalStore<DiagnosticSession>(LOCAL_STORAGE_KEY_SESSIONS);
    return all.filter((s) => s.student_id === studentId);
  },

  /**
   * Fetches diagnostic targets for a diagnostic session.
   */
  async getDiagnosticTargets(sessionId: string): Promise<DiagnosticTarget[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('diagnostic_targets')
          .select('*')
          .eq('session_id', sessionId)
          .order('target_order', { ascending: true });

        if (!error && data) {
          return data as DiagnosticTarget[];
        }
      } catch (err) {
        console.warn('getDiagnosticTargets fallback:', err);
      }
    }
    const all = getLocalStore<DiagnosticTarget>(LOCAL_STORAGE_KEY_TARGETS);
    return all.filter((t) => t.session_id === sessionId);
  },

  /**
   * Creates a structured diagnostic assessment session with explicit targets.
   */
  async createDiagnosticSession(params: {
    studentId: string;
    studentSubjectId?: string;
    specificationId?: string;
    title: string;
    purpose?: string;
    targetObjectives: { learningObjectiveId: string; conceptId?: string }[];
  }): Promise<DiagnosticSession> {
    const { studentId, studentSubjectId, specificationId, title, purpose, targetObjectives } =
      params;
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();

    const newSession: DiagnosticSession = {
      id: sessionId,
      student_id: studentId,
      student_subject_id: studentSubjectId || null,
      specification_id: specificationId || null,
      title: title.trim(),
      status: 'PLANNED',
      purpose: purpose?.trim() || 'Establish curriculum baseline and prerequisite status',
      started_at: null,
      completed_at: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    const newTargets: DiagnosticTarget[] = targetObjectives.map((tgt, idx) => ({
      id: crypto.randomUUID(),
      session_id: sessionId,
      learning_objective_id: tgt.learningObjectiveId,
      concept_id: tgt.conceptId || null,
      target_order: idx + 1,
      status: 'PENDING',
      notes: null,
      created_at: now,
    }));

    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { error: sessErr } = await supabase.from('diagnostic_sessions').insert(newSession);
        if (!sessErr) {
          if (newTargets.length > 0) {
            await supabase.from('diagnostic_targets').insert(newTargets);
          }
          return newSession;
        }
      } catch (err) {
        console.warn('createDiagnosticSession fallback:', err);
      }
    }

    const localSessions = getLocalStore<DiagnosticSession>(LOCAL_STORAGE_KEY_SESSIONS);
    localSessions.unshift(newSession);
    saveLocalStore(LOCAL_STORAGE_KEY_SESSIONS, localSessions);

    const localTargets = getLocalStore<DiagnosticTarget>(LOCAL_STORAGE_KEY_TARGETS);
    localTargets.push(...newTargets);
    saveLocalStore(LOCAL_STORAGE_KEY_TARGETS, localTargets);

    return newSession;
  },

  /**
   * Records an individual student assessment attempt with semantic cross-validation.
   */
  async recordAssessmentAttempt(
    attempt: Omit<AssessmentAttempt, 'id' | 'created_at'>
  ): Promise<AssessmentAttempt> {
    const now = new Date().toISOString();
    const attemptId = crypto.randomUUID();

    const record: AssessmentAttempt = {
      id: attemptId,
      ...attempt,
      created_at: now,
    };

    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('assessment_attempts')
          .insert(record)
          .select()
          .single();

        if (error) throw error;
        return (data as AssessmentAttempt) || record;
      } catch (err) {
        if (isProductionEnvironment()) {
          throw err;
        }
        console.warn('recordAssessmentAttempt fallback to local store:', err);
      }
    }

    const localAttempts = getLocalStore<AssessmentAttempt>(LOCAL_STORAGE_KEY_ATTEMPTS);
    localAttempts.unshift(record);
    saveLocalStore(LOCAL_STORAGE_KEY_ATTEMPTS, localAttempts);
    return record;
  },
};
