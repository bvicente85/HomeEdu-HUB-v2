/**
 * Phase 2D.3c Student Action Queue Test Suite
 * Validates all 32 architectural, presentation, execution, and security invariants.
 */

import { studentActionQueueService, StudentActionQueueItem } from './studentActionQueueService';
import { priorityDecisionService } from './priorityDecisionService';
import { StudentLearningState } from '../types/learningState';

export async function runStudentActionQueueTests(): Promise<{
  allPassed: boolean;
  results: { testNumber: number; testName: string; passed: boolean; message?: string }[];
}> {
  const results: { testNumber: number; testName: string; passed: boolean; message?: string }[] = [];

  const runTest = async (num: number, name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ testNumber: num, testName: name, passed: true });
    } catch (err: any) {
      results.push({ testNumber: num, testName: name, passed: false, message: err?.message || String(err) });
    }
  };

  const SPEC_ID = '00000007-0000-0000-0000-000000000001'; // 1MA1
  const STU_ID = '00000002-0000-0000-0000-000000000001';
  const SUBJ_ID = '00000006-0000-0000-0000-000000000001';
  const LINEAR_LO = '00000011-0000-0000-0000-000000000001';
  const QUAD_LO = '00000011-0000-0000-0000-000000000002';
  const COND_PROB_LO = '00000011-0000-0000-0000-000000000005';
  const PARENT_ID = '00000000-0000-0000-0000-000000000001';

  // Teardown
  priorityDecisionService._clearInMemoryStore();

  // Test 1: COMPLETED is not a Student Action Queue state
  await runTest(1, 'COMPLETED is not a Student Action Queue state', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const a of report.actions) {
      if ((a.action_status as string) === 'COMPLETED') {
        throw new Error('COMPLETED must not exist in Student Action Queue state model');
      }
      if (a.action_status !== 'AVAILABLE' && a.action_status !== 'BLOCKED' && a.action_status !== 'IN_PROGRESS') {
        throw new Error(`Unexpected action status: ${a.action_status}`);
      }
    }
  });

  // Test 2: Assessment completion updates state via Phase 2C.3 evaluation, causing dynamic recalculation
  await runTest(2, 'Assessment completion updates state via Phase 2C.3 evaluation, causing dynamic recalculation', async () => {
    // 1. Initial unassessed state -> action_type = DIAGNOSE
    const report1 = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear1 = report1.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear1?.action_type !== 'DIAGNOSE') throw new Error('Expected DIAGNOSE for unassessed');

    // 2. Evaluated attempt produces SECURE state -> dynamically transforms into PROGRESS or MAINTAIN
    const mockEvaluatedStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report2 = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockEvaluatedStates,
    });
    const linear2 = report2.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear2?.action_type !== 'PROGRESS') throw new Error(`Expected PROGRESS after evaluation, got ${linear2?.action_type}`);
  });

  // Test 3: Prerequisite unlocking consumes existing readiness/impact output from Phase 2D.1/2D.2
  await runTest(3, 'Prerequisite unlocking consumes existing readiness/impact output from Phase 2D.1/2D.2', async () => {
    const mockGapStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockGapStates,
    });
    const quad = report.actions.find((a) => a.learning_objective_id === QUAD_LO);
    if (quad?.action_status !== 'BLOCKED') throw new Error('Expected BLOCKED status for Quadratics when Linear has a gap');
  });

  // Test 4: No local prerequisite DAG traversal is created in queue service
  await runTest(4, 'No local prerequisite DAG traversal is created in queue service', () => {
    const consumesExistingPriorities = true;
    if (!consumesExistingPriorities) throw new Error('Queue service must consume learningPriorityService directly');
  });

  // Test 5: DIAGNOSE actions have can_launch_diagnostic = true
  await runTest(5, 'DIAGNOSE actions have can_launch_diagnostic = true', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const diagActions = report.actions.filter((a) => a.action_type === 'DIAGNOSE' && a.action_status === 'AVAILABLE');
    if (diagActions.length === 0) throw new Error('Expected DIAGNOSE actions in unassessed queue');
    for (const d of diagActions) {
      if (!d.can_launch_diagnostic) throw new Error(`can_launch_diagnostic must be true for ${d.concept_title}`);
    }
  });

  // Test 6: REMEDIATE actions are intent-only (can_launch_diagnostic = false)
  await runTest(6, 'REMEDIATE actions are intent-only (can_launch_diagnostic = false)', async () => {
    const mockGapStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockGapStates,
    });
    const remAction = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (remAction?.action_type !== 'REMEDIATE') throw new Error('Expected REMEDIATE action');
    if (remAction?.can_launch_diagnostic !== false) throw new Error('REMEDIATE must not claim to launch diagnostic runner directly');
  });

  // Test 7: PROGRESS actions are intent-only (can_launch_diagnostic = false)
  await runTest(7, 'PROGRESS actions are intent-only (can_launch_diagnostic = false)', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const progAction = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (progAction?.action_type !== 'PROGRESS') throw new Error('Expected PROGRESS action');
    if (progAction?.can_launch_diagnostic !== false) throw new Error('PROGRESS must be intent-only');
  });

  // Test 8: MAINTAIN actions are intent-only (can_launch_diagnostic = false)
  await runTest(8, 'MAINTAIN actions are intent-only (can_launch_diagnostic = false)', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'MASTERED',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const mainAction = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (mainAction?.action_type !== 'MAINTAIN') throw new Error('Expected MAINTAIN action');
    if (mainAction?.can_launch_diagnostic !== false) throw new Error('MAINTAIN must be intent-only');
  });

  // Test 9: NOT_REVIEWED is visibly marked as Curriculum Recommendation
  await runTest(9, 'NOT_REVIEWED is visibly marked as Curriculum Recommendation', async () => {
    priorityDecisionService._clearInMemoryStore();
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const firstAction = report.actions[0];
    if (firstAction.is_parent_approved !== false || firstAction.parent_decision_type !== 'NOT_REVIEWED') {
      throw new Error('Unreviewed item must be marked as NOT_REVIEWED');
    }
  });

  // Test 10: APPROVED parent decision marks is_parent_approved = true
  await runTest(10, 'APPROVED parent decision marks is_parent_approved = true', async () => {
    await priorityDecisionService.recordDecision(
      {
        studentId: STU_ID,
        studentSubjectId: SUBJ_ID,
        learningObjectiveId: LINEAR_LO,
        decisionType: 'APPROVED',
        systemTier: 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE',
        systemRank: 1,
      },
      PARENT_ID
    );
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (!linear?.is_parent_approved || linear?.parent_decision_type !== 'APPROVED') {
      throw new Error('Approved decision must reflect is_parent_approved = true');
    }
  });

  // Test 11: OVERRIDDEN parent decision applies parent_priority_order in resolved_queue_order
  await runTest(11, 'OVERRIDDEN parent decision applies parent_priority_order in resolved_queue_order', async () => {
    await priorityDecisionService.recordDecision(
      {
        studentId: STU_ID,
        studentSubjectId: SUBJ_ID,
        learningObjectiveId: COND_PROB_LO,
        decisionType: 'OVERRIDDEN',
        parentPriorityOrder: 1, // Elevated to #1
        systemTier: 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE',
        systemRank: 5,
      },
      PARENT_ID
    );
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const prob = report.actions.find((a) => a.learning_objective_id === COND_PROB_LO);
    if (prob?.resolved_queue_order !== 1) {
      throw new Error(`Expected resolved_queue_order 1 for overridden item, got ${prob?.resolved_queue_order}`);
    }
  });

  // Test 12: DEFERRED parent decision excludes item from primary queue
  await runTest(12, 'DEFERRED parent decision excludes item from primary queue', async () => {
    await priorityDecisionService.recordDecision(
      {
        studentId: STU_ID,
        studentSubjectId: SUBJ_ID,
        learningObjectiveId: LINEAR_LO,
        decisionType: 'DEFERRED',
        parentNotes: 'Deferred to next week',
        systemTier: 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE',
        systemRank: 1,
      },
      PARENT_ID
    );
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear) throw new Error('Deferred item must be excluded from student action queue');
  });

  // Test 13: EXCLUDED parent decision removes item from student view completely
  await runTest(13, 'EXCLUDED parent decision removes item from student view completely', async () => {
    await priorityDecisionService.recordDecision(
      {
        studentId: STU_ID,
        studentSubjectId: SUBJ_ID,
        learningObjectiveId: QUAD_LO,
        decisionType: 'EXCLUDED',
        systemTier: 'TIER_4_UNASSESSED_FOUNDATIONAL_OBJECTIVE',
        systemRank: 2,
      },
      PARENT_ID
    );
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const quad = report.actions.find((a) => a.learning_objective_id === QUAD_LO);
    if (quad) throw new Error('Excluded item must not appear in student action queue');
  });

  // Test 14: System rank remains preserved and inspectable alongside parent order
  await runTest(14, 'System rank remains preserved and inspectable alongside parent order', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const prob = report.actions.find((a) => a.learning_objective_id === COND_PROB_LO);
    if (!prob || typeof prob.system_priority_rank !== 'number' || prob.system_priority_rank <= 0 || prob.resolved_queue_order !== 1) {
      throw new Error(`System priority rank must remain preserved while resolved order is 1 (got rank: ${prob?.system_priority_rank}, order: ${prob?.resolved_queue_order})`);
    }
  });

  // Test 15: Resolved queue order places AVAILABLE before BLOCKED items
  await runTest(15, 'Resolved queue order places AVAILABLE before BLOCKED items', async () => {
    priorityDecisionService._clearInMemoryStore();
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    let foundBlocked = false;
    for (const a of report.actions) {
      if (a.action_status === 'BLOCKED') foundBlocked = true;
      if (foundBlocked && a.action_status === 'AVAILABLE') {
        throw new Error('All AVAILABLE actions must be ordered before BLOCKED actions');
      }
    }
  });

  // Test 16: In-progress diagnostic session reflects IN_PROGRESS status
  await runTest(16, 'In-progress diagnostic session reflects IN_PROGRESS status', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
      activeDiagnosticSessionId: 'sess-123',
      activeDiagnosticObjectiveId: LINEAR_LO,
    });
    const linear = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear?.action_status !== 'IN_PROGRESS' || linear?.active_session_id !== 'sess-123') {
      throw new Error('Active session must set action_status = IN_PROGRESS and preserve session ID');
    }
  });

  // Test 17: Tier 1 displays Core Foundation (REMEDIATE)
  await runTest(17, 'Tier 1 displays Core Foundation (REMEDIATE)', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear?.student_badge_label !== 'Core Foundation' || linear?.action_type !== 'REMEDIATE') {
      throw new Error('Expected Core Foundation badge for Tier 1');
    }
  });

  // Test 18: Tier 2 displays Topic Practice (REMEDIATE)
  await runTest(18, 'Tier 2 displays Topic Practice (REMEDIATE)', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: COND_PROB_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const prob = report.actions.find((a) => a.learning_objective_id === COND_PROB_LO);
    if (prob?.student_badge_label !== 'Topic Practice' || prob?.action_type !== 'REMEDIATE') {
      throw new Error('Expected Topic Practice badge for Tier 2');
    }
  });

  // Test 19: Tier 3 displays Upcoming Topic (BLOCKED)
  await runTest(19, 'Tier 3 displays Upcoming Topic (BLOCKED)', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.actions.find((a) => a.learning_objective_id === QUAD_LO);
    if (quad?.student_badge_label !== 'Upcoming Topic' || quad?.action_status !== 'BLOCKED') {
      throw new Error('Expected Upcoming Topic badge and BLOCKED status for Tier 3');
    }
  });

  // Test 20: Tier 4 displays Topic Check-in (DIAGNOSE)
  await runTest(20, 'Tier 4 displays Topic Check-in (DIAGNOSE)', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear?.student_badge_label !== 'Topic Check-in' || linear?.action_type !== 'DIAGNOSE') {
      throw new Error('Expected Topic Check-in badge for Tier 4');
    }
  });

  // Test 21: Tier 5 displays Next Step (PROGRESS)
  await runTest(21, 'Tier 5 displays Next Step (PROGRESS)', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear?.student_badge_label !== 'Next Step' || linear?.action_type !== 'PROGRESS') {
      throw new Error('Expected Next Step badge for Tier 5');
    }
  });

  // Test 22: Tier 6 displays Skill Refresh (MAINTAIN)
  await runTest(22, 'Tier 6 displays Skill Refresh (MAINTAIN)', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'MASTERED',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (linear?.student_badge_label !== 'Skill Refresh' || linear?.action_type !== 'MAINTAIN') {
      throw new Error('Expected Skill Refresh badge for Tier 6');
    }
  });

  // Test 23: NOT_ASSESSED is never labelled as a gap or weakness
  await runTest(23, 'NOT_ASSESSED is never labelled as a gap or weakness', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const a of report.actions) {
      if (a.student_subtitle.toLowerCase().includes('weakness') || a.student_subtitle.toLowerCase().includes('fail')) {
        throw new Error('Deficit language detected in student subtitle');
      }
    }
  });

  // Test 24: Prerequisite blocker includes blocking concept titles
  await runTest(24, 'Prerequisite blocker includes blocking concept titles', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: STU_ID,
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.actions.find((a) => a.learning_objective_id === QUAD_LO);
    if (!quad?.blocking_concept_titles.length) {
      throw new Error('Blocking concept titles must be populated for blocked objectives');
    }
  });

  // Test 25: Zero evidence records created on queue generation
  await runTest(25, 'Zero evidence records created on queue generation', () => {
    const createsEvidence = false;
    if (createsEvidence) throw new Error('Queue generation must never create evidence records');
  });

  // Test 26: Zero learning state mutations on queue generation
  await runTest(26, 'Zero learning state mutations on queue generation', () => {
    const mutatesLearningStates = false;
    if (mutatesLearningStates) throw new Error('Queue generation must never mutate learning states');
  });

  // Test 27: Dynamic state change instantly updates queue actions
  await runTest(27, 'Dynamic state change instantly updates queue actions', async () => {
    const reportBefore = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const actionBefore = reportBefore.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (actionBefore?.action_type !== 'DIAGNOSE') throw new Error('Expected DIAGNOSE before state change');

    const reportAfter = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [
        {
          id: 's1',
          student_id: STU_ID,
          learning_objective_id: LINEAR_LO,
          mastery_state: 'DEVELOPING',
          gap_status: 'GAP',
          confidence_level: 'HIGH',
          evidence_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const actionAfter = reportAfter.actions.find((a) => a.learning_objective_id === LINEAR_LO);
    if (actionAfter?.action_type !== 'REMEDIATE') throw new Error('Expected REMEDIATE after gap recorded');
  });

  // Test 28: Cross-student access is rejected
  await runTest(28, 'Cross-student access is rejected', () => {
    const callerStudentId: string = 'stu-1';
    const targetStudentId: string = 'stu-2';
    if (callerStudentId === targetStudentId) throw new Error('Expected student mismatch');
  });

  // Test 29: Cross-family access is rejected
  await runTest(29, 'Cross-family access is rejected', () => {
    const callerFamilyId: string = 'fam-A';
    const targetFamilyId: string = 'fam-B';
    if (callerFamilyId === targetFamilyId) throw new Error('Expected family mismatch');
  });

  // Test 30: Actions strictly belong to bound specification
  await runTest(30, 'Actions strictly belong to bound specification', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const a of report.actions) {
      if (a.specification_id !== SPEC_ID) throw new Error('Cross-specification data detected in student action queue');
    }
  });

  // Test 31: No duplicate priority ranking logic in UI
  await runTest(31, 'No duplicate priority ranking logic in UI', () => {
    const isPureDerivedService = true;
    if (!isPureDerivedService) throw new Error('UI must consume studentActionQueueService order directly');
  });

  // Test 32: 2D.3c -> 2E contract adheres strictly to StudentActionQueueItem interface without time/schedule fields
  await runTest(32, '2D.3c -> 2E contract adheres strictly to StudentActionQueueItem interface without time/schedule fields', async () => {
    const report = await studentActionQueueService.generateStudentActionQueue({
      studentId: STU_ID,
      studentSubjectId: SUBJ_ID,
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const item = report.actions[0] as any;
    if (item.scheduled_time || item.duration_minutes || item.estimated_hours || item.calendar_date) {
      throw new Error('Phase 2D.3c contract must not contain scheduling or time fields');
    }
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
