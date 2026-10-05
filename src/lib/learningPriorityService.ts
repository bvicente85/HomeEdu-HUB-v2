/**
 * Learning Priority Ranking & Explanation Generator Service (Phase 2D.2)
 *
 * Deterministic intelligence layer that transforms the Phase 2D.1 learning impact
 * projection into an explainable, ordinal ranking of learning priorities.
 *
 * INVARIANTS:
 * 1. Read-only projection: Never modifies the database, ledger, or learning state.
 * 2. Answers "What should this student address next, and why?" without grade/pass prediction.
 * 3. Priority is not learning state (strictly derived in-memory).
 * 4. NOT_ASSESSED / NO_DATA != GAP.
 * 5. Prerequisite blockers do not fabricate student failure evidence.
 * 6. Deterministic tie-breaking across 6 explicit criteria.
 */

import { StudentLearningState } from '../types/learningState';
import {
  learningImpactService,
  ObjectivePrerequisiteImpact,
  PrerequisiteReadiness,
} from './learningImpactService';

export type PriorityTierNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type PriorityTier =
  | 'TIER_1_CRITICAL_FOUNDATIONAL_GAP'
  | 'TIER_2_DIRECT_ISOLATED_GAP'
  | 'TIER_3_BLOCKED_OBJECTIVE'
  | 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE'
  | 'TIER_5_SECURE_NEXT_STEP'
  | 'TIER_6_MASTERED_MAINTENANCE';

export type RecommendedAction =
  | 'REMEDIATE'
  | 'DIAGNOSE'
  | 'DEFER'
  | 'PROGRESS'
  | 'MAINTAIN';

export type RationaleCode =
  | 'CRITICAL_FOUNDATIONAL_GAP'
  | 'DIRECT_GAP'
  | 'BLOCKED_BY_PREREQUISITE'
  | 'DIAGNOSTIC_REQUIRED'
  | 'READY_TO_PROGRESS'
  | 'MASTERED_MAINTENANCE'
  | 'RETENTION_CHECK'
  | 'UNVERIFIED_PREREQUISITES';

export interface LearningPriority {
  learning_objective_id: string;
  learning_objective_code: string;
  learning_objective_statement: string;
  concept_id: string;
  concept_code: string;
  concept_title: string;
  topic_id: string;
  topic_title: string;
  specification_id: string;

  priority_tier_number: PriorityTierNumber;
  priority_tier: PriorityTier;
  priority_rank: number;

  mastery_state: string;
  gap_status: string;

  prerequisite_status: PrerequisiteReadiness;
  is_prerequisite_blocked: boolean;
  blocking_objectives: string[];
  blocking_concepts: string[];

  downstream_objective_count: number;
  downstream_concept_count: number;
  is_blocking_downstream: boolean;

  rationale_code: RationaleCode;
  rationale: string;
  recommended_action: RecommendedAction;

  retention_check_due?: boolean;
  verification_recommended?: boolean;
}

export interface StudentPriorityReport {
  student_id: string;
  student_subject_id?: string;
  specification_id: string;
  specification_name: string;
  total_priorities: number;
  tier_1_count: number;
  tier_2_count: number;
  tier_3_count: number;
  tier_4_count: number;
  tier_5_count: number;
  tier_6_count: number;
  priorities: LearningPriority[];
  evaluated_at: string;
}

export const learningPriorityService = {
  /**
   * Generates deterministic, ranked learning priorities from the Phase 2D.1 impact projection.
   */
  async generateStudentPriorities(params: {
    studentId: string;
    studentSubjectId?: string;
    specificationId: string;
    mockLearningStates?: StudentLearningState[];
  }): Promise<StudentPriorityReport> {
    const { studentId, studentSubjectId, specificationId, mockLearningStates } = params;

    // 1. Generate underlying prerequisite impact projection
    const impactReport = await learningImpactService.generateSubjectImpactReport({
      studentId,
      studentSubjectId,
      specificationId,
      mockLearningStates,
    });

    const now = new Date();

    // 2. Classify and map each objective into structured priority item
    const unrankedPriorities: (Omit<LearningPriority, 'priority_rank'> & {
      sort_order: number;
    })[] = [];

    for (const item of impactReport.objectives) {
      const {
        learning_objective_id,
        learning_objective_code,
        learning_objective_statement,
        concept_id,
        concept_code,
        concept_title,
        topic_id,
        topic_title,
        specification_id: itemSpecId,
        authoritative_mastery_state,
        authoritative_gap_status,
        prerequisite_readiness,
        has_direct_gap,
        is_prerequisite_blocked,
        blocking_chain,
        downstream_impact,
        confidence_level,
        last_assessed_at,
      } = item;

      let tierNumber: PriorityTierNumber = 4;
      let tierName: PriorityTier = 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE';
      let action: RecommendedAction = 'DIAGNOSE';
      let rationaleCode: RationaleCode = 'DIAGNOSTIC_REQUIRED';
      let rationaleText = '';
      let retentionCheckDue = false;
      let verificationRecommended = false;

      // Extract blocking objective and concept references
      const blockingObjectives: string[] = [];
      const blockingConcepts: string[] = [];
      blocking_chain.forEach((b) => {
        blockingObjectives.push(b.learning_objective_code);
        if (!blockingConcepts.includes(b.concept_title)) {
          blockingConcepts.push(b.concept_title);
        }
      });

      // Contextual check: Recency check flag (Deterministic rule: > 90 days since assessment on SECURE items)
      if (authoritative_mastery_state === 'SECURE' && last_assessed_at) {
        const assessedDate = new Date(last_assessed_at);
        const diffDays = Math.floor((now.getTime() - assessedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 90) {
          retentionCheckDue = true;
        }
      }

      // Contextual check: Support verification recommendation (LOW confidence or supported attempt)
      if (authoritative_mastery_state === 'SECURE' && confidence_level === 'LOW') {
        verificationRecommended = true;
      }

      // -------------------------------------------------------------
      // DETERMINISTIC TIER CLASSIFICATION
      // -------------------------------------------------------------
      if (has_direct_gap) {
        if (downstream_impact.transitive_downstream_concept_count > 0) {
          // TIER 1: Critical Foundational Gap
          tierNumber = 1;
          tierName = 'TIER_1_CRITICAL_FOUNDATIONAL_GAP';
          action = 'REMEDIATE';
          rationaleCode = 'CRITICAL_FOUNDATIONAL_GAP';
          const sampleDependents = downstream_impact.transitive_downstream_objective_codes.slice(0, 3).join(', ');
          rationaleText = `${concept_title} (${learning_objective_code}) is prioritised for immediate remediation because the current learning state is ${authoritative_mastery_state} with a demonstrated ${authoritative_gap_status}, and it is a strict prerequisite blocking ${downstream_impact.transitive_downstream_objective_count} downstream objective(s) (${sampleDependents}).`;
        } else {
          // TIER 2: Direct Isolated Gap
          tierNumber = 2;
          tierName = 'TIER_2_DIRECT_ISOLATED_GAP';
          action = 'REMEDIATE';
          rationaleCode = 'DIRECT_GAP';
          rationaleText = `${concept_title} (${learning_objective_code}) is prioritised for direct remediation because a learning gap (${authoritative_mastery_state} / ${authoritative_gap_status}) has been demonstrated. No downstream topics are currently blocked.`;
        }
      } else if (is_prerequisite_blocked) {
        // TIER 3: Blocked Objective (Prerequisite blocker)
        tierNumber = 3;
        tierName = 'TIER_3_BLOCKED_OBJECTIVE';
        action = 'DEFER';
        rationaleCode = 'BLOCKED_BY_PREREQUISITE';

        if (authoritative_mastery_state === 'NOT_ASSESSED') {
          rationaleText = `${concept_title} (${learning_objective_code}) has not yet been assessed and is currently deferred because it is blocked by prerequisite gap(s) in: ${blockingConcepts.join(', ')}. No direct evidence of a gap has been recorded for this objective.`;
        } else {
          rationaleText = `${concept_title} (${learning_objective_code}) is currently deferred because upstream prerequisite gap(s) in ${blockingConcepts.join(', ')} must be remediated first.`;
        }
      } else if (authoritative_mastery_state === 'NOT_ASSESSED') {
        // TIER 4: Unassessed Foundational Objective
        tierNumber = 4;
        tierName = 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE';
        action = 'DIAGNOSE';

        if (prerequisite_readiness === 'SATISFIED') {
          rationaleCode = 'DIAGNOSTIC_REQUIRED';
          rationaleText = `${concept_title} (${learning_objective_code}) has not yet been assessed and is eligible for baseline diagnostic assessment because all strict prerequisites are satisfied.`;
        } else {
          rationaleCode = 'UNVERIFIED_PREREQUISITES';
          rationaleText = `${concept_title} (${learning_objective_code}) has not yet been assessed. Upstream prerequisites are also unassessed; foundational diagnostics recommended.`;
        }
      } else if (authoritative_mastery_state === 'SECURE') {
        // TIER 5: Secure / Next Step
        tierNumber = 5;
        tierName = 'TIER_5_SECURE_NEXT_STEP';
        action = 'PROGRESS';

        if (retentionCheckDue) {
          rationaleCode = 'RETENTION_CHECK';
          rationaleText = `${concept_title} (${learning_objective_code}) is SECURE (${authoritative_gap_status}). A periodic retention check is recommended as it has been over 90 days since last assessment.`;
        } else {
          rationaleCode = 'READY_TO_PROGRESS';
          rationaleText = `${concept_title} (${learning_objective_code}) is SECURE (${authoritative_gap_status}) and all strict prerequisites are satisfied. Ready for curriculum progression.`;
        }

        if (verificationRecommended) {
          rationaleText += ' Independent verification practice recommended to consolidate competence.';
        }
      } else if (authoritative_mastery_state === 'MASTERED') {
        // TIER 6: Mastered Maintenance
        tierNumber = 6;
        tierName = 'TIER_6_MASTERED_MAINTENANCE';
        action = 'MAINTAIN';
        rationaleCode = 'MASTERED_MAINTENANCE';
        rationaleText = `${concept_title} (${learning_objective_code}) is MASTERED. Ready for fluency maintenance; does not compete with active gaps.`;
      }

      unrankedPriorities.push({
        learning_objective_id,
        learning_objective_code,
        learning_objective_statement,
        concept_id,
        concept_code,
        concept_title,
        topic_id,
        topic_title,
        specification_id: itemSpecId,

        priority_tier_number: tierNumber,
        priority_tier: tierName,

        mastery_state: authoritative_mastery_state,
        gap_status: authoritative_gap_status,

        prerequisite_status: prerequisite_readiness,
        is_prerequisite_blocked,
        blocking_objectives: blockingObjectives,
        blocking_concepts: blockingConcepts,

        downstream_objective_count: downstream_impact.transitive_downstream_objective_count,
        downstream_concept_count: downstream_impact.transitive_downstream_concept_count,
        is_blocking_downstream: downstream_impact.is_blocking_downstream,

        rationale_code: rationaleCode,
        rationale: rationaleText,
        recommended_action: action,

        retention_check_due: retentionCheckDue || undefined,
        verification_recommended: verificationRecommended || undefined,
        sort_order: 0, // Assigned below during tie-breaking
      });
    }

    // -------------------------------------------------------------
    // DETERMINISTIC TIE-BREAKING & RANKING
    // 1. priority_tier_number ASC (1 to 6)
    // 2. downstream_objective_count DESC (most downstream unblocked first)
    // 3. concept_code ASC alphanumeric
    // 4. learning_objective_code ASC alphanumeric
    // 5. learning_objective_id ASC
    // -------------------------------------------------------------
    unrankedPriorities.sort((a, b) => {
      // 1. Tier number
      if (a.priority_tier_number !== b.priority_tier_number) {
        return a.priority_tier_number - b.priority_tier_number;
      }
      // 2. Downstream impact count (DESC)
      if (a.downstream_objective_count !== b.downstream_objective_count) {
        return b.downstream_objective_count - a.downstream_objective_count;
      }
      // 3. Concept code (ASC)
      const conceptCmp = a.concept_code.localeCompare(b.concept_code);
      if (conceptCmp !== 0) return conceptCmp;
      // 4. Learning Objective code (ASC)
      const loCmp = a.learning_objective_code.localeCompare(b.learning_objective_code);
      if (loCmp !== 0) return loCmp;
      // 5. Stable ID tie-breaker
      return a.learning_objective_id.localeCompare(b.learning_objective_id);
    });

    // 3. Assign 1-indexed priority ranks
    const rankedPriorities: LearningPriority[] = unrankedPriorities.map((item, idx) => {
      const { sort_order, ...rest } = item;
      return {
        ...rest,
        priority_rank: idx + 1,
      };
    });

    const tier1Count = rankedPriorities.filter((p) => p.priority_tier_number === 1).length;
    const tier2Count = rankedPriorities.filter((p) => p.priority_tier_number === 2).length;
    const tier3Count = rankedPriorities.filter((p) => p.priority_tier_number === 3).length;
    const tier4Count = rankedPriorities.filter((p) => p.priority_tier_number === 4).length;
    const tier5Count = rankedPriorities.filter((p) => p.priority_tier_number === 5).length;
    const tier6Count = rankedPriorities.filter((p) => p.priority_tier_number === 6).length;

    return {
      student_id: studentId,
      student_subject_id: studentSubjectId,
      specification_id: specificationId,
      specification_name: impactReport.specification_name,
      total_priorities: rankedPriorities.length,
      tier_1_count: tier1Count,
      tier_2_count: tier2Count,
      tier_3_count: tier3Count,
      tier_4_count: tier4Count,
      tier_5_count: tier5Count,
      tier_6_count: tier6Count,
      priorities: rankedPriorities,
      evaluated_at: new Date().toISOString(),
    };
  },
};
