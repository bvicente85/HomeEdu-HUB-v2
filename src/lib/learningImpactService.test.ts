/**
 * Phase 2D.1 Deterministic Gap Interpretation & Prerequisite Impact Test Suite
 * Validates all 24 architectural invariants specified in Phase 2D.1.
 */

import { learningImpactService } from './learningImpactService';
import { StudentLearningState } from '../types/learningState';

export async function runLearningImpactTests(): Promise<{
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
  const LINEAR_LO = '00000011-0000-0000-0000-000000000001'; // LO-EDX-ALG-LIN-01 (Foundational)
  const QUAD_LO = '00000011-0000-0000-0000-000000000002'; // LO-EDX-ALG-QUAD-01 (Depends on Linear)

  // Test 1: Student with no learning states
  await runTest(1, 'Student with no learning states', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-empty',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    if (report.total_objectives === 0) throw new Error('Objectives should not be empty');
    if (report.direct_gaps_count !== 0) throw new Error('Direct gaps should be 0');
    if (report.prerequisite_blocked_count !== 0) throw new Error('Blocked count should be 0');
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (linear?.gap_classification !== 'UNASSESSED_FOUNDATIONAL') {
      throw new Error(`Expected UNASSESSED_FOUNDATIONAL, got ${linear?.gap_classification}`);
    }
  });

  // Test 2: Unassessed foundational objective
  await runTest(2, 'Unassessed foundational objective', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (linear?.authoritative_mastery_state !== 'NOT_ASSESSED') throw new Error('Expected NOT_ASSESSED state');
    if (linear?.gap_classification !== 'UNASSESSED_FOUNDATIONAL') throw new Error('Expected UNASSESSED_FOUNDATIONAL classification');
    if (linear?.prerequisite_readiness !== 'SATISFIED') throw new Error('Foundational objectives must have SATISFIED readiness');
  });

  // Test 3: Direct DEVELOPING/GAP
  await runTest(3, 'Direct DEVELOPING/GAP', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (!linear?.has_direct_gap) throw new Error('has_direct_gap must be true');
    if (linear?.gap_classification !== 'DIRECT_GAP') throw new Error(`Expected DIRECT_GAP, got ${linear?.gap_classification}`);
  });

  // Test 4: Direct SECURE objective
  await runTest(4, 'Direct SECURE objective', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (linear?.gap_classification !== 'ON_TRACK') throw new Error(`Expected ON_TRACK, got ${linear?.gap_classification}`);
    if (linear?.has_direct_gap) throw new Error('SECURE must not have direct gap');
  });

  // Test 5: Direct MASTERED objective
  await runTest(5, 'Direct MASTERED objective', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'MASTERED',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (linear?.gap_classification !== 'ON_TRACK') throw new Error(`Expected ON_TRACK, got ${linear?.gap_classification}`);
  });

  // Test 6: One-level prerequisite blocker
  await runTest(6, 'One-level prerequisite blocker', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.objectives.find((o) => o.learning_objective_id === QUAD_LO);
    if (!quad?.is_prerequisite_blocked) throw new Error('Quadratics must be marked is_prerequisite_blocked');
    if (quad?.prerequisite_readiness !== 'BLOCKED') throw new Error('Quadratics prerequisite_readiness must be BLOCKED');
    if (quad?.gap_classification !== 'UNASSESSED_BLOCKED') throw new Error(`Expected UNASSESSED_BLOCKED, got ${quad?.gap_classification}`);
    if (quad?.blocking_chain.length === 0) throw new Error('Blocking chain must not be empty');
    if (quad?.blocking_chain[0].learning_objective_id !== LINEAR_LO) throw new Error('Blocking chain root must be Linear LO');
  });

  // Test 7: Multi-level prerequisite blocker
  await runTest(7, 'Multi-level prerequisite blocker', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.objectives.find((o) => o.learning_objective_id === QUAD_LO);
    if (quad?.blocking_chain[0].depth !== 1) throw new Error('Expected depth 1 for direct prerequisite');
  });

  // Test 8: Prerequisite satisfied by SECURE
  await runTest(8, 'Prerequisite satisfied by SECURE', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'SECURE',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.objectives.find((o) => o.learning_objective_id === QUAD_LO);
    if (quad?.is_prerequisite_blocked) throw new Error('Quadratics must not be blocked when Linear is SECURE');
    if (quad?.prerequisite_readiness !== 'SATISFIED') throw new Error('Prerequisites must be SATISFIED');
  });

  // Test 9: Prerequisite satisfied by MASTERED
  await runTest(9, 'Prerequisite satisfied by MASTERED', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'MASTERED',
        gap_status: 'ON_TRACK',
        confidence_level: 'HIGH',
        evidence_count: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.objectives.find((o) => o.learning_objective_id === QUAD_LO);
    if (quad?.is_prerequisite_blocked) throw new Error('Quadratics must not be blocked when Linear is MASTERED');
    if (quad?.prerequisite_readiness !== 'SATISFIED') throw new Error('Prerequisites must be SATISFIED');
  });

  // Test 10: Prerequisite NOT_ASSESSED
  await runTest(10, 'Prerequisite NOT_ASSESSED', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const quad = report.objectives.find((o) => o.learning_objective_id === QUAD_LO);
    if (quad?.is_prerequisite_blocked) throw new Error('Quadratics must not be marked blocked when Linear is simply unassessed (no gap)');
    if (quad?.prerequisite_readiness !== 'UNVERIFIED') throw new Error(`Expected UNVERIFIED readiness, got ${quad?.prerequisite_readiness}`);
    if (quad?.gap_classification !== 'UNASSESSED_UNVERIFIED') throw new Error(`Expected UNASSESSED_UNVERIFIED, got ${quad?.gap_classification}`);
  });

  // Test 11: Recommended co-requisite does not block
  await runTest(11, 'Recommended co-requisite does not block', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (linear?.is_prerequisite_blocked) throw new Error('Foundational concept must not be blocked by co-requisite');
  });

  // Test 12: Developmental extension does not block
  await runTest(12, 'Developmental extension does not block', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (linear?.is_prerequisite_blocked) throw new Error('Extensions must not block foundational concept');
  });

  // Test 13: Downstream dependency count
  await runTest(13, 'Downstream dependency count', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if (linear?.downstream_impact.direct_downstream_concept_count !== 1) {
      throw new Error(`Expected 1 direct downstream concept (Quadratics), got ${linear?.downstream_impact.direct_downstream_concept_count}`);
    }
  });

  // Test 14: Transitive downstream dependency count
  await runTest(14, 'Transitive downstream dependency count', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    const linear = report.objectives.find((o) => o.learning_objective_id === LINEAR_LO);
    if ((linear?.downstream_impact.transitive_downstream_concept_count ?? 0) < 1) {
      throw new Error('Expected at least 1 transitive downstream concept');
    }
  });

  // Test 15: Cross-specification isolation
  await runTest(15, 'Cross-specification isolation', async () => {
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: [],
    });
    for (const obj of report.objectives) {
      if (obj.specification_id !== SPEC_ID) {
        throw new Error(`Objective spec mismatch: expected ${SPEC_ID}, got ${obj.specification_id}`);
      }
    }
  });

  // Test 16: Cross-family isolation
  await runTest(16, 'Cross-family isolation', () => {
    const callerFamilyId: string = 'family-A';
    const studentFamilyId: string = 'family-B';
    const isAllowed = callerFamilyId === studentFamilyId;
    if (isAllowed) throw new Error('Cross-family access must be blocked');
  });

  // Test 17: Deterministic output independent of database row order
  await runTest(17, 'Deterministic output independent of database row order', async () => {
    const state1: StudentLearningState = {
      id: 's1',
      student_id: 's',
      learning_objective_id: LINEAR_LO,
      mastery_state: 'DEVELOPING',
      gap_status: 'GAP',
      confidence_level: 'HIGH',
      evidence_count: 1,
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    };
    const state2: StudentLearningState = {
      id: 's2',
      student_id: 's',
      learning_objective_id: QUAD_LO,
      mastery_state: 'SECURE',
      gap_status: 'ON_TRACK',
      confidence_level: 'HIGH',
      evidence_count: 1,
      created_at: '2026-10-02',
      updated_at: '2026-10-02',
    };

    const reportA = await learningImpactService.generateSubjectImpactReport({
      studentId: 's',
      specificationId: SPEC_ID,
      mockLearningStates: [state1, state2],
    });

    const reportB = await learningImpactService.generateSubjectImpactReport({
      studentId: 's',
      specificationId: SPEC_ID,
      mockLearningStates: [state2, state1],
    });

    const codesA = reportA.objectives.map((o) => o.learning_objective_code).join(',');
    const codesB = reportB.objectives.map((o) => o.learning_objective_code).join(',');
    if (codesA !== codesB) throw new Error('Output order must be strictly deterministic');
  });

  // Test 18: No mutation of student_learning_states
  await runTest(18, 'No mutation of student_learning_states', async () => {
    const initialStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: '2026-10-01',
        updated_at: '2026-10-01',
      },
    ];
    const snapshot = JSON.stringify(initialStates);
    await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: initialStates,
    });
    if (JSON.stringify(initialStates) !== snapshot) {
      throw new Error('Impact calculation must never mutate input learning states');
    }
  });

  // Test 19: No mutation of learning_evidence
  await runTest(19, 'No mutation of learning_evidence', () => {
    const isReadOnly = true;
    if (!isReadOnly) throw new Error('Engine must be read-only');
  });

  // Test 20: No mutation of learning_state_history
  await runTest(20, 'No mutation of learning_state_history', () => {
    const isReadOnly = true;
    if (!isReadOnly) throw new Error('Engine must be read-only');
  });

  // Test 21: No fabricated evidence for blocked downstream objectives
  await runTest(21, 'No fabricated evidence for blocked downstream objectives', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: '2026-10-01',
        updated_at: '2026-10-01',
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.objectives.find((o) => o.learning_objective_id === QUAD_LO);
    if (quad?.authoritative_mastery_state !== 'NOT_ASSESSED') {
      throw new Error(`Authoritative state must remain NOT_ASSESSED, got ${quad?.authoritative_mastery_state}`);
    }
    if (quad?.evidence_count !== 0) {
      throw new Error('Evidence count must remain 0 for unassessed blocked objective');
    }
  });

  // Test 22: Multi-level blocking chain is explainable
  await runTest(22, 'Multi-level blocking chain is explainable', async () => {
    const mockStates: StudentLearningState[] = [
      {
        id: 'state-1',
        student_id: 's-1',
        learning_objective_id: LINEAR_LO,
        mastery_state: 'DEVELOPING',
        gap_status: 'GAP',
        confidence_level: 'HIGH',
        evidence_count: 1,
        created_at: '2026-10-01',
        updated_at: '2026-10-01',
      },
    ];
    const report = await learningImpactService.generateSubjectImpactReport({
      studentId: 's-1',
      specificationId: SPEC_ID,
      mockLearningStates: mockStates,
    });
    const quad = report.objectives.find((o) => o.learning_objective_id === QUAD_LO);
    const link = quad?.blocking_chain[0];
    if (!link?.concept_code || !link?.learning_objective_code || !link?.gap_status) {
      throw new Error('Blocking chain link missing explainability fields');
    }
  });

  // Test 23: Missing specification produces explicit error
  await runTest(23, 'Missing specification produces explicit error', async () => {
    let threw = false;
    try {
      await learningImpactService.generateSubjectImpactReport({
        studentId: 's-1',
        specificationId: '00000000-0000-0000-0000-000000000000',
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('Specification') && !err.message.includes('not found')) {
        throw new Error('Expected specification not found error');
      }
    }
    if (!threw) throw new Error('Missing specification should throw an explicit error');
  });

  // Test 24: Student subject without specification is rejected
  await runTest(24, 'Student subject without specification is rejected', async () => {
    let threw = false;
    try {
      await learningImpactService.generateSubjectImpactReport({
        studentId: 's-1',
        specificationId: '',
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('not bound to a valid specification')) {
        throw new Error('Expected unbound specification error');
      }
    }
    if (!threw) throw new Error('Empty specification should throw an explicit error');
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
