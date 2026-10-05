/**
 * Student Action Queue Service (Phase 2D.3c.1)
 *
 * Pure deterministic derived projection service.
 * Transforms Phase 2D.2 deterministic priorities and Phase 2D.3a/b parent decisions
 * into an actionable, encouraging, and unblocked student queue.
 *
 * INVARIANTS:
 * 1. Pure Read-Only Derived Projection (zero new database tables).
 * 2. Status Model: AVAILABLE | BLOCKED | IN_PROGRESS (no task completion state).
 * 3. Separation of Concerns: Action Intent ≠ Assessment ≠ Evidence ≠ Learning State.
 * 4. NOT_ASSESSED ≠ GAP: Unassessed topics are presented as exploratory diagnostic check-ins.
 * 5. Consumes prerequisite readiness directly from Phase 2D.1/2D.2 without local re-traversal.
 * 6. Explicit Provenance: Distinguishes "Parent-Approved Focus" from "Curriculum Recommendation".
 * 7. Strict Family & Specification Boundary Enforcement.
 */

import { learningPriorityService, LearningPriority, StudentPriorityReport } from './learningPriorityService';
import { priorityDecisionService, StudentPriorityDecision } from './priorityDecisionService';
import { StudentLearningState } from '../types/learningState';
import { getSupabaseClient, isSupabaseReachable } from './supabase';

export type StudentActionType = 'DIAGNOSE' | 'REMEDIATE' | 'PROGRESS' | 'MAINTAIN';
export type StudentActionStatus = 'AVAILABLE' | 'BLOCKED' | 'IN_PROGRESS';

export interface StudentActionQueueItem {
  // Curriculum & Objective Identity
  learning_objective_id: string;
  learning_objective_code: string;
  concept_id: string;
  concept_code: string;
  concept_title: string;
  topic_title: string;
  specification_id: string;

  // Pedagogical Action Intent & Execution State
  action_type: StudentActionType;
  action_status: StudentActionStatus;

  // Student-Facing Presentation (Growth-Oriented)
  student_title: string;
  student_subtitle: string;
  student_badge_label: string;
  resolved_queue_order: number; // 1-indexed display order

  // Provenance & Parent Decision Context
  system_priority_tier: string;
  system_priority_rank: number;
  parent_decision_type: 'APPROVED' | 'OVERRIDDEN' | 'NOT_REVIEWED';
  parent_priority_order?: number | null;
  is_parent_approved: boolean;

  // Prerequisite & Blocker Guidance
  is_prerequisite_blocked: boolean;
  blocking_concept_titles: string[];

  // Execution Capabilities
  can_launch_diagnostic: boolean; // true strictly for DIAGNOSE actions
  active_session_id?: string | null;
}

export interface StudentActionQueueReport {
  student_id: string;
  student_subject_id: string;
  specification_id: string;
  specification_name?: string;
  actions: StudentActionQueueItem[];
  active_actions_count: number;
  diagnostic_checkins_count: number;
  blocked_actions_count: number;
  progression_count: number;
  generated_at: string;
}

export interface GenerateStudentActionQueueParams {
  studentId: string;
  studentSubjectId: string;
  specificationId: string;
  mockLearningStates?: StudentLearningState[];
  activeDiagnosticSessionId?: string | null;
  activeDiagnosticObjectiveId?: string | null;
}

export const studentActionQueueService = {
  /**
   * Derives the student action queue from deterministic priorities and parent decisions.
   */
  async generateStudentActionQueue(
    params: GenerateStudentActionQueueParams
  ): Promise<StudentActionQueueReport> {
    const {
      studentId,
      studentSubjectId,
      specificationId,
      mockLearningStates,
      activeDiagnosticSessionId,
      activeDiagnosticObjectiveId,
    } = params;

    // 1. Fetch deterministic priorities (Phase 2D.2)
    const priorityReport = await learningPriorityService.generateStudentPriorities({
      studentId,
      studentSubjectId,
      specificationId,
      mockLearningStates,
    });

    // 2. Fetch current parent decisions (Phase 2D.3a)
    const parentDecisions = await priorityDecisionService.getCurrentDecisionsForStudent(
      studentId,
      studentSubjectId
    );

    const decisionMap = new Map<string, StudentPriorityDecision>();
    parentDecisions.forEach((d) => decisionMap.set(d.learning_objective_id, d));

    // 3. Transform and filter priorities into student actions
    const candidateActions: {
      item: StudentActionQueueItem;
      sortKey: {
        isBlocked: number; // 0 for available, 1 for blocked
        parentOrder: number; // custom parent order (if set) or Infinity
        systemTier: number; // 1 to 6
        systemRank: number; // system rank
      };
    }[] = [];

    for (const priority of priorityReport.priorities) {
      const decision = decisionMap.get(priority.learning_objective_id);

      // Parent EXCLUDED: completely invisible to the student
      if (decision?.decision_type === 'EXCLUDED') {
        continue;
      }

      // Parent DEFERRED: excluded from primary active queue
      if (decision?.decision_type === 'DEFERRED') {
        continue;
      }

      // Map Action Type & Student Framing
      const actionType = this.mapPriorityToActionType(priority);
      const { studentTitle, studentSubtitle, badgeLabel } = this.formatStudentLabels(priority, actionType);

      // Determine Status (AVAILABLE | BLOCKED | IN_PROGRESS)
      let actionStatus: StudentActionStatus = priority.is_prerequisite_blocked ? 'BLOCKED' : 'AVAILABLE';
      let activeSessionId: string | null = null;

      if (
        activeDiagnosticObjectiveId &&
        activeDiagnosticObjectiveId === priority.learning_objective_id &&
        activeDiagnosticSessionId
      ) {
        actionStatus = 'IN_PROGRESS';
        activeSessionId = activeDiagnosticSessionId;
      }

      // Provenance mapping
      const isParentApproved = decision?.decision_type === 'APPROVED' || decision?.decision_type === 'OVERRIDDEN';
      const parentDecisionType: 'APPROVED' | 'OVERRIDDEN' | 'NOT_REVIEWED' =
        decision?.decision_type === 'APPROVED'
          ? 'APPROVED'
          : decision?.decision_type === 'OVERRIDDEN'
          ? 'OVERRIDDEN'
          : 'NOT_REVIEWED';

      const parentOrder =
        decision?.decision_type === 'OVERRIDDEN' && typeof decision.parent_priority_order === 'number'
          ? decision.parent_priority_order
          : typeof decision?.parent_priority_order === 'number'
          ? decision.parent_priority_order
          : null;

      const item: StudentActionQueueItem = {
        learning_objective_id: priority.learning_objective_id,
        learning_objective_code: priority.learning_objective_code,
        concept_id: priority.concept_id,
        concept_code: priority.concept_code,
        concept_title: priority.concept_title,
        topic_title: priority.topic_title,
        specification_id: priority.specification_id,

        action_type: actionType,
        action_status: actionStatus,

        student_title: studentTitle,
        student_subtitle: studentSubtitle,
        student_badge_label: badgeLabel,
        resolved_queue_order: 0, // Assigned after sorting

        system_priority_tier: priority.priority_tier,
        system_priority_rank: priority.priority_rank,
        parent_decision_type: parentDecisionType,
        parent_priority_order: parentOrder,
        is_parent_approved: isParentApproved,

        is_prerequisite_blocked: priority.is_prerequisite_blocked,
        blocking_concept_titles: priority.blocking_concepts || [],

        can_launch_diagnostic: actionType === 'DIAGNOSE' && actionStatus !== 'BLOCKED',
        active_session_id: activeSessionId,
      };

      candidateActions.push({
        item,
        sortKey: {
          isBlocked: priority.is_prerequisite_blocked ? 1 : 0,
          parentOrder: parentOrder !== null ? parentOrder : Number.MAX_SAFE_INTEGER,
          systemTier: priority.priority_tier_number,
          systemRank: priority.priority_rank,
        },
      });
    }

    // 4. Sort actions deterministically:
    // a) Available actions before Blocked actions
    // b) Parent Custom Order (if set)
    // c) System Priority Tier
    // d) System Priority Rank
    candidateActions.sort((a, b) => {
      // Available before blocked
      if (a.sortKey.isBlocked !== b.sortKey.isBlocked) {
        return a.sortKey.isBlocked - b.sortKey.isBlocked;
      }

      // Parent custom order (if explicitly set on either)
      if (a.sortKey.parentOrder !== b.sortKey.parentOrder) {
        return a.sortKey.parentOrder - b.sortKey.parentOrder;
      }

      // System tier
      if (a.sortKey.systemTier !== b.sortKey.systemTier) {
        return a.sortKey.systemTier - b.sortKey.systemTier;
      }

      // System rank
      return a.sortKey.systemRank - b.sortKey.systemRank;
    });

    // 5. Assign resolved 1-indexed queue order
    const actions: StudentActionQueueItem[] = candidateActions.map((wrapper, index) => {
      wrapper.item.resolved_queue_order = index + 1;
      return wrapper.item;
    });

    const activeCount = actions.filter((a) => a.action_status === 'AVAILABLE' && (a.action_type === 'REMEDIATE' || a.action_type === 'DIAGNOSE')).length;
    const diagCount = actions.filter((a) => a.action_type === 'DIAGNOSE' && a.action_status === 'AVAILABLE').length;
    const blockedCount = actions.filter((a) => a.action_status === 'BLOCKED').length;
    const progCount = actions.filter((a) => a.action_type === 'PROGRESS' || a.action_type === 'MAINTAIN').length;

    return {
      student_id: studentId,
      student_subject_id: studentSubjectId,
      specification_id: specificationId,
      specification_name: priorityReport.specification_name,
      actions,
      active_actions_count: activeCount,
      diagnostic_checkins_count: diagCount,
      blocked_actions_count: blockedCount,
      progression_count: progCount,
      generated_at: new Date().toISOString(),
    };
  },

  /**
   * Maps deterministic priority to student action type.
   */
  mapPriorityToActionType(priority: LearningPriority): StudentActionType {
    switch (priority.priority_tier_number) {
      case 1:
      case 2:
        return 'REMEDIATE';
      case 3:
        // For Tier 3 blocked items, recommended action is mapped based on whether it is unassessed or gap
        return priority.mastery_state === 'NOT_ASSESSED' ? 'DIAGNOSE' : 'REMEDIATE';
      case 4:
        return 'DIAGNOSE';
      case 5:
        return 'PROGRESS';
      case 6:
        return 'MAINTAIN';
      default:
        return 'DIAGNOSE';
    }
  },

  /**
   * Formats constructive, non-stigmatizing student labels.
   */
  formatStudentLabels(
    priority: LearningPriority,
    actionType: StudentActionType
  ): { studentTitle: string; studentSubtitle: string; badgeLabel: string } {
    if (priority.is_prerequisite_blocked) {
      const blockerList = priority.blocking_concepts.join(', ');
      return {
        studentTitle: priority.concept_title,
        studentSubtitle: blockerList
          ? `Unlocks after mastering ${blockerList}`
          : 'Unlocks after prerequisite topics reach required readiness',
        badgeLabel: 'Upcoming Topic',
      };
    }

    switch (priority.priority_tier_number) {
      case 1:
        return {
          studentTitle: priority.concept_title,
          studentSubtitle: 'Core foundation topic to unlock future learning',
          badgeLabel: 'Core Foundation',
        };
      case 2:
        return {
          studentTitle: priority.concept_title,
          studentSubtitle: 'Focused topic practice to build confidence',
          badgeLabel: 'Topic Practice',
        };
      case 4:
        return {
          studentTitle: priority.concept_title,
          studentSubtitle: 'Quick diagnostic check-in to discover your starting point',
          badgeLabel: 'Topic Check-in',
        };
      case 5:
        return {
          studentTitle: priority.concept_title,
          studentSubtitle: 'You have solid foundations — ready for the next progression step',
          badgeLabel: 'Next Step',
        };
      case 6:
        return {
          studentTitle: priority.concept_title,
          studentSubtitle: 'Quick retention review to keep your fluency sharp',
          badgeLabel: 'Skill Refresh',
        };
      default:
        return {
          studentTitle: priority.concept_title,
          studentSubtitle: 'Curriculum learning target',
          badgeLabel: 'Learning Step',
        };
    }
  },
};
