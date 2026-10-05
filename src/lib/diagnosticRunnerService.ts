/**
 * Diagnostic Runner Service (Phase 2C.3)
 * Handles deterministic assessment item selection, response submission,
 * and server-authoritative evaluation pipeline.
 */

import { AssessmentItem, AssessmentItemContent } from '../types/curriculum';
import { AssessmentAttempt, DiagnosticSession, DiagnosticTarget } from '../types/database';
import { getSupabaseClient, isSupabaseReachable } from './supabase';
import { REFERENCE_DETAILED_1MA1 } from './curriculumService';
import { assessmentItemService } from './assessmentItemService';

export interface DiagnosticTargetWithItem extends DiagnosticTarget {
  assessment_item?: AssessmentItem & {
    content?: AssessmentItemContent[];
    active_content?: AssessmentItemContent;
  };
  learning_objective_statement?: string;
  learning_objective_code?: string;
  attempt?: AssessmentAttempt;
}

export interface DiagnosticSessionExecutionDetails {
  session: DiagnosticSession;
  targets: DiagnosticTargetWithItem[];
  isCompleted: boolean;
  totalTargets: number;
  completedTargets: number;
  currentTargetIndex: number;
}

export interface DiagnosticSubmissionResult {
  attempt_id: string;
  evidence_id?: string;
  evaluation_result: 'CORRECT' | 'INCORRECT' | 'INVALID_RESPONSE' | 'UNSUPPORTED';
  raw_score: number;
  max_score: number;
  is_correct: boolean;
  previous_mastery?: string;
  new_mastery?: string;
  previous_gap?: string;
  new_gap?: string;
  session_completed: boolean;
  pending_targets_remaining: number;
}

export const diagnosticRunnerService = {
  /**
   * Deterministically selects the appropriate assessment item for a diagnostic target.
   * Tie-breaker:
   * 1. Match student tier (e.g. 'Higher' -> 'Higher' | 'Common')
   * 2. item_reference alphanumeric ascending
   */
  async selectAssessmentItemForTarget(
    target: DiagnosticTarget,
    specificationId: string,
    studentTier?: string
  ): Promise<(AssessmentItem & { active_content?: AssessmentItemContent; content?: AssessmentItemContent[] }) | null> {
    const allItems = await assessmentItemService.getAssessmentItemsForSpecification(specificationId);
    const candidateItems = allItems.filter(
      (item) => item.learning_objective_id === target.learning_objective_id
    );

    if (candidateItems.length === 0) {
      return null;
    }

    // Sort by tier match preference, then item_reference ASC
    candidateItems.sort((a, b) => {
      if (studentTier && studentTier !== 'Not applicable') {
        const aMatchesTier = a.tier === studentTier || a.tier === 'Common';
        const bMatchesTier = b.tier === studentTier || b.tier === 'Common';
        if (aMatchesTier && !bMatchesTier) return -1;
        if (!aMatchesTier && bMatchesTier) return 1;
      }
      return a.item_reference.localeCompare(b.item_reference);
    });

    const chosen = candidateItems[0];
    return {
      ...chosen,
      active_content: chosen.content_items?.[0] || chosen.content?.[0],
      content: chosen.content_items || chosen.content,
    };
  },

  /**
   * Fetches complete execution details for a diagnostic session.
   */
  async getSessionExecutionDetails(
    sessionId: string,
    studentId: string
  ): Promise<DiagnosticSessionExecutionDetails> {
    let session: DiagnosticSession | null = null;
    let rawTargets: DiagnosticTarget[] = [];
    let attempts: AssessmentAttempt[] = [];

    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data: sessData, error: sessErr } = await supabase
          .from('diagnostic_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('student_id', studentId)
          .single();

        if (!sessErr && sessData) {
          session = sessData as DiagnosticSession;

          const { data: targetData } = await supabase
            .from('diagnostic_targets')
            .select('*')
            .eq('session_id', sessionId)
            .order('target_order', { ascending: true });

          rawTargets = (targetData as DiagnosticTarget[]) || [];

          const { data: attemptData } = await supabase
            .from('assessment_attempts')
            .select('*')
            .eq('diagnostic_session_id', sessionId);

          attempts = (attemptData as AssessmentAttempt[]) || [];
        }
      } catch (err) {
        console.warn('getSessionExecutionDetails Supabase fetch fallback:', err);
      }
    }

    // Fallback: Local storage session store for offline dev
    if (!session) {
      const LOCAL_SESSIONS_KEY = 'homeedu_diagnostic_sessions';
      const LOCAL_TARGETS_KEY = 'homeedu_diagnostic_targets';
      const LOCAL_ATTEMPTS_KEY = 'homeedu_assessment_attempts';

      const localSessions: DiagnosticSession[] = JSON.parse(
        localStorage.getItem(LOCAL_SESSIONS_KEY) || '[]'
      );
      session = localSessions.find((s) => s.id === sessionId && s.student_id === studentId) || null;

      if (session) {
        const localTargets: DiagnosticTarget[] = JSON.parse(
          localStorage.getItem(LOCAL_TARGETS_KEY) || '[]'
        );
        rawTargets = localTargets
          .filter((t) => t.session_id === sessionId)
          .sort((a, b) => a.target_order - b.target_order);

        const localAttempts: AssessmentAttempt[] = JSON.parse(
          localStorage.getItem(LOCAL_ATTEMPTS_KEY) || '[]'
        );
        attempts = localAttempts.filter((a) => a.diagnostic_session_id === sessionId);
      }
    }

    if (!session) {
      throw new Error(`Diagnostic session ${sessionId} not found or unauthorized for student ${studentId}.`);
    }

    const specId = session.specification_id || '00000007-0000-0000-0000-000000000001';

    // Map objectives metadata and bind deterministic items
    const boundTargets: DiagnosticTargetWithItem[] = [];
    for (const target of rawTargets) {
      const item = await this.selectAssessmentItemForTarget(target, specId);
      const attempt = attempts.find((a) => a.learning_objective_id === target.learning_objective_id);

      // Find objective metadata
      let loCode: string | undefined;
      let loStatement: string | undefined;

      REFERENCE_DETAILED_1MA1.topics.forEach((t) => {
        t.concepts.forEach((c) => {
          c.learning_objectives.forEach((lo) => {
            if (lo.id === target.learning_objective_id) {
              loCode = lo.code;
              loStatement = lo.statement;
            }
          });
        });
      });

      boundTargets.push({
        ...target,
        assessment_item: item || undefined,
        learning_objective_code: loCode,
        learning_objective_statement: loStatement,
        attempt,
      });
    }

    const completedTargets = boundTargets.filter((t) => t.status === 'ASSESSED' || t.attempt).length;
    let currentTargetIndex = boundTargets.findIndex((t) => t.status === 'PENDING' && !t.attempt);
    if (currentTargetIndex === -1) {
      currentTargetIndex = boundTargets.length > 0 ? boundTargets.length - 1 : 0;
    }

    return {
      session,
      targets: boundTargets,
      isCompleted: session.status === 'COMPLETED' || (boundTargets.length > 0 && completedTargets === boundTargets.length),
      totalTargets: boundTargets.length,
      completedTargets,
      currentTargetIndex,
    };
  },

  /**
   * Submits a student response for a target assessment item.
   * Invokes the server-authoritative PostgreSQL RPC `submit_diagnostic_response`.
   */
  async submitResponse(params: {
    studentId: string;
    sessionId: string;
    targetId: string;
    assessmentItemId: string;
    submittedResponse: string;
    supportLevel?: 'INDEPENDENT' | 'MINOR_SUPPORT' | 'SIGNIFICANT_SUPPORT';
  }): Promise<DiagnosticSubmissionResult> {
    const { studentId, sessionId, targetId, assessmentItemId, submittedResponse, supportLevel = 'INDEPENDENT' } = params;

    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase.rpc('submit_diagnostic_response', {
          p_student_id: studentId,
          p_session_id: sessionId,
          p_target_id: targetId,
          p_assessment_item_id: assessmentItemId,
          p_submitted_response: submittedResponse,
          p_support_level: supportLevel,
        });

        if (error) {
          throw error;
        }

        return data as DiagnosticSubmissionResult;
      } catch (err: any) {
        console.warn('submit_diagnostic_response RPC fallback:', err);
        if (err?.message?.includes('Unauthorized') || err?.message?.includes('Domain error') || err?.message?.includes('Duplicate submission')) {
          throw err;
        }
      }
    }

    // Local deterministic evaluation fallback for dev environment
    return this.evaluateResponseLocally({
      ...params,
      supportLevel,
    });
  },

  /**
   * Deterministic local evaluator for offline / mock testing.
   */
  evaluateResponseLocally(params: {
    studentId: string;
    sessionId: string;
    targetId: string;
    assessmentItemId: string;
    submittedResponse: string;
    previousMastery?: string;
    supportLevel?: 'INDEPENDENT' | 'MINOR_SUPPORT' | 'SIGNIFICANT_SUPPORT';
  }): DiagnosticSubmissionResult {
    const { sessionId, assessmentItemId, submittedResponse, previousMastery, supportLevel = 'INDEPENDENT' } = params;

    // Sanitize support level
    const sanitizedSupport = ['INDEPENDENT', 'MINOR_SUPPORT', 'SIGNIFICANT_SUPPORT'].includes(supportLevel)
      ? supportLevel
      : 'INDEPENDENT';

    const item = (REFERENCE_DETAILED_1MA1.assessment_items || []).find((i) => i.id === assessmentItemId);
    const content = item?.content?.[0];

    if (!content) {
      return {
        attempt_id: crypto.randomUUID(),
        evaluation_result: 'UNSUPPORTED',
        raw_score: 0,
        max_score: item?.total_marks || 1,
        is_correct: false,
        session_completed: false,
        pending_targets_remaining: 1,
      };
    }

    let evalResult: 'CORRECT' | 'INCORRECT' | 'INVALID_RESPONSE' = 'INCORRECT';
    const trimmedSub = submittedResponse.trim();
    const trimmedCan = content.canonical_answer.trim();
    const maxScore = item?.total_marks || 1;

    if (content.content_format === 'MULTIPLE_CHOICE') {
      evalResult = trimmedSub.toUpperCase() === trimmedCan.toUpperCase() ? 'CORRECT' : 'INCORRECT';
    } else if (content.content_format === 'SHORT_NUMERIC') {
      const numSub = parseFloat(trimmedSub);
      const numCan = parseFloat(trimmedCan);
      if (isNaN(numSub)) {
        evalResult = 'INVALID_RESPONSE';
      } else {
        const tol = content.answer_tolerance || 0;
        evalResult = Math.abs(numSub - numCan) <= tol ? 'CORRECT' : 'INCORRECT';
      }
    } else if (content.content_format === 'EXACT_EXPRESSION') {
      const cleanSub = trimmedSub.replace(/\s+/g, '').toLowerCase();
      const cleanCan = trimmedCan.replace(/\s+/g, '').toLowerCase();
      if (cleanSub === cleanCan) {
        evalResult = 'CORRECT';
      } else {
        const eqMatches = (content.equivalent_representations || []).some(
          (rep) => cleanSub === rep.replace(/\s+/g, '').toLowerCase()
        );
        evalResult = eqMatches ? 'CORRECT' : 'INCORRECT';
      }
    }

    const isCorrect = evalResult === 'CORRECT';
    const rawScore = isCorrect ? maxScore : 0;

    // Authoritative state transition:
    // - Correct answers never promote unmastered states to MASTERED from a single diagnostic item
    // - Correct answers preserve prior MASTERED state
    // - Incorrect answers transition to DEVELOPING (GAP)
    const prevMastery = previousMastery || 'NOT_ASSESSED';
    let newMastery = 'DEVELOPING';
    let newGap = 'GAP';

    if (isCorrect) {
      newMastery = prevMastery === 'MASTERED' ? 'MASTERED' : 'SECURE';
      newGap = 'ON_TRACK';
    } else {
      newMastery = 'DEVELOPING';
      newGap = 'GAP';
    }

    // Update local storage session state if available
    const hasLocalStorage = typeof localStorage !== 'undefined';
    const LOCAL_SESSIONS_KEY = 'homeedu_diagnostic_sessions';
    const LOCAL_TARGETS_KEY = 'homeedu_diagnostic_targets';
    const LOCAL_ATTEMPTS_KEY = 'homeedu_assessment_attempts';

    let remainingTargets = 0;
    let sessionCompleted = false;

    if (hasLocalStorage) {
      const localTargets: DiagnosticTarget[] = JSON.parse(
        localStorage.getItem(LOCAL_TARGETS_KEY) || '[]'
      );
      const targetIdx = localTargets.findIndex((t) => t.id === params.targetId);
      if (targetIdx !== -1) {
        localTargets[targetIdx].status = 'ASSESSED';
        localStorage.setItem(LOCAL_TARGETS_KEY, JSON.stringify(localTargets));
      }

      remainingTargets = localTargets.filter(
        (t) => t.session_id === sessionId && t.status === 'PENDING'
      ).length;

      sessionCompleted = remainingTargets === 0;

      if (sessionCompleted) {
        const localSessions: DiagnosticSession[] = JSON.parse(
          localStorage.getItem(LOCAL_SESSIONS_KEY) || '[]'
        );
        const sessIdx = localSessions.findIndex((s) => s.id === sessionId);
        if (sessIdx !== -1) {
          localSessions[sessIdx].status = 'COMPLETED';
          localSessions[sessIdx].completed_at = new Date().toISOString();
          localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(localSessions));
        }
      }

      const attemptId = crypto.randomUUID();
      const localAttempts: AssessmentAttempt[] = JSON.parse(
        localStorage.getItem(LOCAL_ATTEMPTS_KEY) || '[]'
      );
      localAttempts.push({
        id: attemptId,
        student_id: params.studentId,
        learning_objective_id: item?.learning_objective_id || '',
        diagnostic_session_id: sessionId,
        assessment_item_id: assessmentItemId,
        attempted_at: new Date().toISOString(),
        result: isCorrect ? 'CORRECT' : 'INCORRECT',
        raw_score: rawScore,
        max_score: maxScore,
        support_level: sanitizedSupport,
        notes: `Submitted: ${trimmedSub} | Evaluation: ${evalResult}`,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(localAttempts));
    }

    return {
      attempt_id: crypto.randomUUID(),
      evidence_id: crypto.randomUUID(),
      evaluation_result: evalResult,
      raw_score: rawScore,
      max_score: maxScore,
      is_correct: isCorrect,
      previous_mastery: prevMastery,
      new_mastery: newMastery,
      previous_gap: prevMastery === 'NOT_ASSESSED' ? 'NO_DATA' : undefined,
      new_gap: newGap,
      session_completed: sessionCompleted,
      pending_targets_remaining: remainingTargets,
    };
  },
};
