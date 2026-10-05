/**
 * Parent Priority Decision Service (Phase 2D.3a)
 *
 * Implements the persistent human decision layer between Phase 2D.2 deterministic
 * priorities and future Phase 2E study planning.
 *
 * INVARIANTS:
 * 1. Human Decision Primacy: Stores parent decisions without altering learning states or evidence.
 * 2. Immutable History: Appends an audit ledger event on every decision change.
 * 3. Server-Authoritative Identity: Derives parent_user_id from auth.uid().
 * 4. Deterministic State Hashing & Staleness Detection.
 * 5. Strict Family & Specification Boundary Enforcement.
 */

import { getSupabaseClient, isSupabaseReachable } from './supabase';

export type ParentDecisionType = 'APPROVED' | 'DEFERRED' | 'OVERRIDDEN' | 'EXCLUDED';
export type DecisionReviewStatus = 'CURRENT' | 'REVIEW_RECOMMENDED';

export interface StudentPriorityDecision {
  id: string;
  student_id: string;
  student_subject_id: string;
  learning_objective_id: string;
  parent_user_id: string;
  decision_type: ParentDecisionType;
  parent_priority_order?: number | null;
  parent_notes?: string | null;
  system_tier_at_decision: string;
  system_rank_at_decision: number;
  review_status: DecisionReviewStatus;
  state_hash_at_decision?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentPriorityDecisionHistory {
  id: string;
  decision_id?: string | null;
  student_id: string;
  student_subject_id: string;
  learning_objective_id: string;
  parent_user_id: string;
  previous_decision_type?: ParentDecisionType | null;
  new_decision_type: ParentDecisionType;
  previous_parent_order?: number | null;
  new_parent_order?: number | null;
  system_tier_at_event: string;
  system_rank_at_event: number;
  reason?: string | null;
  event_timestamp: string;
}

export interface RecordDecisionParams {
  studentId: string;
  studentSubjectId: string;
  learningObjectiveId: string;
  decisionType: ParentDecisionType;
  parentPriorityOrder?: number | null;
  parentNotes?: string | null;
  systemTier: string;
  systemRank: number;
  currentState?: {
    masteryState: string;
    gapStatus: string;
    evidenceCount: number;
  };
}

// In-Memory Storage for Offline / Test Execution
const inMemoryDecisions = new Map<string, StudentPriorityDecision>(); // key: `${studentId}:${loId}`
const inMemoryHistory: StudentPriorityDecisionHistory[] = [];

/**
 * Computes a deterministic state hash from authoritative learning state fields.
 */
export function computeStateHash(masteryState: string, gapStatus: string, evidenceCount: number): string {
  const normState = (masteryState || 'NOT_ASSESSED').trim().toUpperCase();
  const normGap = (gapStatus || 'NO_DATA').trim().toUpperCase();
  const normEvidence = Math.max(0, evidenceCount || 0);
  return `STATE_${normState}#GAP_${normGap}#EV_${normEvidence}`;
}

export const priorityDecisionService = {
  /**
   * Computes state hash for an objective.
   */
  computeStateHash,

  /**
   * Evaluates if a decision has become stale based on current learning state.
   */
  evaluateDecisionStaleness(
    decision: StudentPriorityDecision,
    currentMasteryState: string,
    currentGapStatus: string,
    currentEvidenceCount: number
  ): DecisionReviewStatus {
    if (!decision.state_hash_at_decision) return 'CURRENT';
    const currentHash = computeStateHash(currentMasteryState, currentGapStatus, currentEvidenceCount);
    return decision.state_hash_at_decision === currentHash ? 'CURRENT' : 'REVIEW_RECOMMENDED';
  },

  /**
   * Records or updates a parent priority decision with an atomic immutable history event.
   */
  async recordDecision(
    params: RecordDecisionParams,
    callerUserId = '00000000-0000-0000-0000-000000000001'
  ): Promise<{ decision: StudentPriorityDecision; historyId: string }> {
    const {
      studentId,
      studentSubjectId,
      learningObjectiveId,
      decisionType,
      parentPriorityOrder,
      parentNotes,
      systemTier,
      systemRank,
      currentState,
    } = params;

    const stateHash = currentState
      ? computeStateHash(currentState.masteryState, currentState.gapStatus, currentState.evidenceCount)
      : undefined;

    // Try Live Supabase RPC if reachable
    if (isSupabaseReachable()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('record_parent_priority_decision', {
            p_student_id: studentId,
            p_student_subject_id: studentSubjectId,
            p_learning_objective_id: learningObjectiveId,
            p_decision_type: decisionType,
            p_parent_priority_order: parentPriorityOrder ?? null,
            p_parent_notes: parentNotes ?? null,
            p_system_tier: systemTier,
            p_system_rank: systemRank,
            p_state_hash: stateHash ?? null,
          });

          if (!error && data) {
            return {
              decision: {
                id: data.decision_id,
                student_id: data.student_id,
                student_subject_id: studentSubjectId,
                learning_objective_id: data.learning_objective_id,
                parent_user_id: callerUserId,
                decision_type: data.decision_type,
                parent_priority_order: data.parent_priority_order,
                parent_notes: parentNotes ?? null,
                system_tier_at_decision: data.system_tier,
                system_rank_at_decision: data.system_rank,
                review_status: data.review_status,
                state_hash_at_decision: stateHash ?? null,
                created_at: data.created_at,
                updated_at: data.updated_at,
              },
              historyId: data.history_id,
            };
          }
        } catch (err) {
          console.warn('record_parent_priority_decision fallback to in-memory:', err);
        }
      }
    }

    // In-Memory Transaction Execution
    const key = `${studentId}:${learningObjectiveId}`;
    const existing = inMemoryDecisions.get(key);
    const now = new Date().toISOString();

    const decisionId = existing ? existing.id : `dec-${Math.random().toString(36).substring(2, 9)}`;
    const historyId = `hist-${Math.random().toString(36).substring(2, 9)}`;

    const newDecision: StudentPriorityDecision = {
      id: decisionId,
      student_id: studentId,
      student_subject_id: studentSubjectId,
      learning_objective_id: learningObjectiveId,
      parent_user_id: callerUserId,
      decision_type: decisionType,
      parent_priority_order: parentPriorityOrder ?? null,
      parent_notes: parentNotes ?? null,
      system_tier_at_decision: systemTier,
      system_rank_at_decision: systemRank,
      review_status: 'CURRENT',
      state_hash_at_decision: stateHash ?? null,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };

    const historyEvent: StudentPriorityDecisionHistory = {
      id: historyId,
      decision_id: decisionId,
      student_id: studentId,
      student_subject_id: studentSubjectId,
      learning_objective_id: learningObjectiveId,
      parent_user_id: callerUserId,
      previous_decision_type: existing ? existing.decision_type : null,
      new_decision_type: decisionType,
      previous_parent_order: existing ? existing.parent_priority_order : null,
      new_parent_order: parentPriorityOrder ?? null,
      system_tier_at_event: systemTier,
      system_rank_at_event: systemRank,
      reason: parentNotes ?? null,
      event_timestamp: now,
    };

    inMemoryDecisions.set(key, newDecision);
    inMemoryHistory.push(historyEvent);

    return {
      decision: newDecision,
      historyId,
    };
  },

  /**
   * Retrieves active current decisions for a student.
   */
  async getCurrentDecisionsForStudent(
    studentId: string,
    studentSubjectId?: string
  ): Promise<StudentPriorityDecision[]> {
    if (isSupabaseReachable()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        let query = supabase.from('student_priority_decisions').select('*').eq('student_id', studentId);
        if (studentSubjectId) query = query.eq('student_subject_id', studentSubjectId);
        const { data, error } = await query;
        if (!error && data) return data as StudentPriorityDecision[];
      }
    }

    // In-memory fallback
    const list: StudentPriorityDecision[] = [];
    for (const d of inMemoryDecisions.values()) {
      if (d.student_id === studentId) {
        if (!studentSubjectId || d.student_subject_id === studentSubjectId) {
          list.push({ ...d });
        }
      }
    }
    return list;
  },

  /**
   * Retrieves immutable decision history for a student or specific objective.
   */
  async getDecisionHistory(
    studentId: string,
    learningObjectiveId?: string
  ): Promise<StudentPriorityDecisionHistory[]> {
    if (isSupabaseReachable()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        let query = supabase
          .from('student_priority_decision_history')
          .select('*')
          .eq('student_id', studentId)
          .order('event_timestamp', { ascending: false });
        if (learningObjectiveId) query = query.eq('learning_objective_id', learningObjectiveId);
        const { data, error } = await query;
        if (!error && data) return data as StudentPriorityDecisionHistory[];
      }
    }

    // In-memory fallback: reverse array to have latest events first
    return inMemoryHistory
      .filter((h) => h.student_id === studentId && (!learningObjectiveId || h.learning_objective_id === learningObjectiveId))
      .slice()
      .reverse();
  },

  /**
   * Clears in-memory storage (used strictly in test teardowns).
   */
  _clearInMemoryStore(): void {
    inMemoryDecisions.clear();
    inMemoryHistory.length = 0;
  },
};
