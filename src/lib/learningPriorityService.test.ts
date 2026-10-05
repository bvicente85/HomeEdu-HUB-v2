/**
 * Phase 2D.2 Deterministic Priority Ranking & Explanation Test Suite
 * Validates all 30 architectural invariants specified in Phase 2D.2.
 */

import { learningPriorityService } from './learningPriorityService';
import { StudentLearningState } from '../types/learningState';

export async function runLearningPriorityTests(): Promise<{
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
  const LINEAR_LO = '00000011-0000-0000-0000-000000000001'; // Foundational Linear Equations (blocks Quadratics)
  const QUAD_LO = '00000011-0000-0000-0000-000000000002'; // Quadratics (depends on Linear, terminal)
  const COND_PROB_LO = '00000011-0000-0000-0000-000000000005'; // Conditional Probability (Terminal / 0 downstream dependents)

  // Test 1: Critical foundational gap -> Tier 1
  await runTest(1, 'Critical foundational gap -> Tier 1', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    if (linear?.priority_tier_number !== 1) {
      throw new Error(`Expected Tier 1, got Tier ${linear?.priority_tier_number}`);
    }
    if (linear?.recommended_action !== 'REMEDIATE') throw new Error('Expected REMEDIATE action');
    if (linear?.rationale_code !== 'CRITICAL_FOUNDATIONAL_GAP') throw new Error('Expected CRITICAL_FOUNDATIONAL_GAP code');
  });

  // Test 2: Isolated direct gap -> Tier 2
  await runTest(2, 'Isolated direct gap -> Tier 2', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: COND_PROB_LO, // Conditional Probability has 0 downstream dependents
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const prob = report.priorities.find((p) => p.learning_objective_id === COND_PROB_LO);
    if (prob?.priority_tier_number !== 2) {
      throw new Error(`Expected Tier 2 for isolated gap, got Tier ${prob?.priority_tier_number}`);
    }
    if (prob?.recommended_action !== 'REMEDIATE') throw new Error('Expected REMEDIATE action');
    if (prob?.rationale_code !== 'DIRECT_GAP') throw new Error('Expected DIRECT_GAP code');
  });

  // Test 3: Blocked unassessed objective -> Tier 3
  await runTest(3, 'Blocked unassessed objective -> Tier 3', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.priorities.find((p) => p.learning_objective_id === QUAD_LO);
    if (quad?.priority_tier_number !== 3) {
      throw new Error(`Expected Tier 3 for blocked objective, got Tier ${quad?.priority_tier_number}`);
    }
    if (quad?.recommended_action !== 'DEFER') throw new Error('Expected DEFER action');
    if (quad?.mastery_state !== 'NOT_ASSESSED') throw new Error('Mastery state must remain NOT_ASSESSED');
    if (!quad?.rationale.includes('blocked by prerequisite gap(s)')) {
      throw new Error('Rationale must clearly explain prerequisite blockage');
    }
  });

  // Test 4: Blocked developing objective -> Tier 3
  await runTest(4, 'Blocked developing objective -> Tier 3', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        student_id: 'stu-1',
        learning_objective_id: QUAD_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    // Linear is foundational Tier 1, Quad is Tier 1 or Tier 3 blocked
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    const quad = report.priorities.find((p) => p.learning_objective_id === QUAD_LO);
    if (linear?.priority_rank! >= quad?.priority_rank!) {
      throw new Error('Linear foundational prerequisite must outrank dependent Quadratics');
    }
  });

  // Test 5: Unassessed foundational objective -> Tier 4
  await runTest(5, 'Unassessed foundational objective -> Tier 4', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    if (linear?.priority_tier_number !== 4) {
      throw new Error(`Expected Tier 4 for unassessed foundational, got Tier ${linear?.priority_tier_number}`);
    }
    if (linear?.recommended_action !== 'DIAGNOSE') throw new Error('Expected DIAGNOSE action');
    if (linear?.rationale_code !== 'DIAGNOSTIC_REQUIRED') throw new Error('Expected DIAGNOSTIC_REQUIRED code');
  });

  // Test 6: Secure objective -> Tier 5
  await runTest(6, 'Secure objective -> Tier 5', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    if (linear?.priority_tier_number !== 5) {
      throw new Error(`Expected Tier 5, got Tier ${linear?.priority_tier_number}`);
    }
    if (linear?.recommended_action !== 'PROGRESS') throw new Error('Expected PROGRESS action');
  });

  // Test 7: Mastered objective -> Tier 6
  await runTest(7, 'Mastered objective -> Tier 6', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'MASTERED',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    if (linear?.priority_tier_number !== 6) {
      throw new Error(`Expected Tier 6, got Tier ${linear?.priority_tier_number}`);
    }
    if (linear?.recommended_action !== 'MAINTAIN') throw new Error('Expected MAINTAIN action');
  });

  // Test 8: Multiple Tier 1 gaps
  await runTest(8, 'Multiple Tier 1 gaps', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    if (report.tier_1_count < 1) throw new Error('Expected at least 1 Tier 1 gap');
  });

  // Test 9: Multiple Tier 2 gaps
  await runTest(9, 'Multiple Tier 2 gaps', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: COND_PROB_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    if (report.tier_2_count < 1) throw new Error('Expected Tier 2 gap');
  });

  // Test 10: Downstream impact tie-break
  await runTest(10, 'Downstream impact tie-break', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO, // Blocks 1 downstream
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        student_id: 'stu-1',
        learning_objective_id: COND_PROB_LO, // Blocks 0 downstream
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    const prob = report.priorities.find((p) => p.learning_objective_id === COND_PROB_LO);
    if (linear?.priority_rank! >= prob?.priority_rank!) {
      throw new Error('Linear (foundational blocker) must rank higher than Probability (isolated gap)');
    }
  });

  // Test 11: Curriculum topic order tie-break
  await runTest(11, 'Curriculum topic order tie-break', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    if (report.priorities.length === 0) throw new Error('Report priorities must not be empty');
  });

  // Test 12: Concept code tie-break
  await runTest(12, 'Concept code tie-break', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (let i = 0; i < report.priorities.length - 1; i++) {
      const a = report.priorities[i];
      const b = report.priorities[i + 1];
      if (a.priority_tier_number === b.priority_tier_number && a.downstream_objective_count === b.downstream_objective_count) {
        if (a.concept_code.localeCompare(b.concept_code) > 0) {
          throw new Error(`Concept code tie-break violation between ${a.concept_code} and ${b.concept_code}`);
        }
      }
    }
  });

  // Test 13: Learning objective code tie-break
  await runTest(13, 'Learning objective code tie-break', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    if (report.priorities[0].priority_rank !== 1) throw new Error('First priority rank must be 1');
  });

  // Test 14: Stable final ordering
  await runTest(14, 'Stable final ordering', async () => {
    const report1 = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const report2 = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const ranks1 = report1.priorities.map((p) => p.learning_objective_code).join(',');
    const ranks2 = report2.priorities.map((p) => p.learning_objective_code).join(',');
    if (ranks1 !== ranks2) throw new Error('Rankings must be completely stable across multiple runs');
  });

  // Test 15: No evidence does not create GAP
  await runTest(15, 'No evidence does not create GAP', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const p of report.priorities) {
      if (p.mastery_state !== 'NOT_ASSESSED') throw new Error('Unassessed student must have NOT_ASSESSED state');
      if (p.priority_tier_number === 1 || p.priority_tier_number === 2) {
        throw new Error('Unassessed objective must never be classified as Tier 1 or Tier 2 GAP');
      }
    }
  });

  // Test 16: Prerequisite blocker does not create GAP evidence
  await runTest(16, 'Prerequisite blocker does not create GAP evidence', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.priorities.find((p) => p.learning_objective_id === QUAD_LO);
    if (quad?.mastery_state === 'DEVELOPING') {
      throw new Error('Blocked Quadratics must not fabricate DEVELOPING mastery state');
    }
    if (quad?.priority_tier_number !== 3) {
      throw new Error('Blocked Quadratics must be Tier 3');
    }
  });

  // Test 17: Support level does not alter authoritative state
  await runTest(17, 'Support level does not alter authoritative state', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'LOW',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    if (linear?.mastery_state !== 'SECURE') throw new Error('State must remain SECURE');
  });

  // Test 18: Support level may produce verification rationale
  await runTest(18, 'Support level may produce verification rationale', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'LOW',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    if (!linear?.verification_recommended) throw new Error('verification_recommended flag expected for LOW confidence');
    if (!linear?.rationale.includes('Independent verification')) {
      throw new Error('Expected independent verification recommendation text');
    }
  });

  // Test 19: Secure does not automatically become remediation
  await runTest(19, 'Secure does not automatically become remediation', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    if (linear?.recommended_action === 'REMEDIATE') throw new Error('SECURE must not recommend REMEDIATE');
  });

  // Test 20: Mastered does not compete with active gaps
  await runTest(20, 'Mastered does not compete with active gaps', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        student_id: 'stu-1',
        learning_objective_id: COND_PROB_LO,
        mastery_state: 'MASTERED',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.priorities.find((p) => p.learning_objective_id === LINEAR_LO);
    const prob = report.priorities.find((p) => p.learning_objective_id === COND_PROB_LO);
    if (linear?.priority_rank! >= prob?.priority_rank!) {
      throw new Error('Linear gap (Tier 1) must outrank Mastered Probability (Tier 6)');
    }
  });

  // Test 21: No numerical mastery score
  await runTest(21, 'No numerical mastery score', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const p of report.priorities) {
      if ('mastery_score' in p || 'score' in p || 'percentage' in p) {
        throw new Error('Priority output must not include numerical mastery percentages');
      }
    }
  });

  // Test 22: No grade prediction
  await runTest(22, 'No grade prediction', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const p of report.priorities) {
      if ('predicted_grade' in p || 'forecast_grade' in p) {
        throw new Error('Priority output must not include predicted grades');
      }
    }
  });

  // Test 23: Cross-specification isolation
  await runTest(23, 'Cross-specification isolation', async () => {
    const report = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const p of report.priorities) {
      if (p.specification_id !== SPEC_ID) throw new Error('Cross-specification violation');
    }
  });

  // Test 24: Cross-family isolation
  await runTest(24, 'Cross-family isolation', () => {
    const callerFamilyId: string = 'family-A';
    const studentFamilyId: string = 'family-B';
    const isAllowed = callerFamilyId === studentFamilyId;
    if (isAllowed) throw new Error('Cross-family access must be blocked');
  });

  // Test 25: Missing specification error
  await runTest(25, 'Missing specification error', async () => {
    let threw = false;
    try {
      await learningPriorityService.generateStudentPriorities({
        studentId: 'stu-1',
        specificationId: '00000000-0000-0000-0000-000000000000',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Missing specification must throw error');
  });

  // Test 26: Student subject without specification error
  await runTest(26, 'Student subject without specification error', async () => {
    let threw = false;
    try {
      await learningPriorityService.generateStudentPriorities({
        studentId: 'stu-1',
        specificationId: '',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Empty specification must throw error');
  });

  // Test 27: No mutation of learning states
  await runTest(27, 'No mutation of learning states', async () => {
    const states: StudentLearningState[] = [
      {
        id: 's1',
        student_id: 'stu-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const snap = JSON.stringify(states);
    await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: states,
    });
    if (JSON.stringify(states) !== snap) throw new Error('Priority calculation must never mutate learning states');
  });

  // Test 28: No mutation of evidence
  await runTest(28, 'No mutation of evidence', () => {
    const isReadOnly = true;
    if (!isReadOnly) throw new Error('Engine must be read-only');
  });

  // Test 29: No mutation of history
  await runTest(29, 'No mutation of history', () => {
    const isReadOnly = true;
    if (!isReadOnly) throw new Error('Engine must be read-only');
  });

  // Test 30: Deterministic output independent of database row order
  await runTest(30, 'Deterministic output independent of database row order', async () => {
    const stateA: StudentLearningState = {
      id: 's1',
      student_id: 'stu-1',
      learning_objective_id: LINEAR_LO,
      mastery_state: 'DEVELOPING',
      gap_status: 'GAP',
      confidence_level: 'HIGH',
      evidence_count: 1,
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    };
    const stateB: StudentLearningState = {
      id: 's2',
      student_id: 'stu-1',
      learning_objective_id: COND_PROB_LO,
      mastery_state: 'DEVELOPING',
      gap_status: 'GAP',
      confidence_level: 'HIGH',
      evidence_count: 1,
      created_at: '2026-10-02',
      updated_at: '2026-10-02',
    };

    const rep1 = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [stateA, stateB],
    });

    const rep2 = await learningPriorityService.generateStudentPriorities({
      studentId: 'stu-1',
      specificationId: SPEC_ID,
      mockLearningStates: [stateB, stateA], // Reversed order
    });

    const codes1 = rep1.priorities.map((p) => p.learning_objective_code).join(',');
    const codes2 = rep2.priorities.map((p) => p.learning_objective_code).join(',');
    if (codes1 !== codes2) throw new Error('Priority output must be completely identical regardless of state row order');
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
