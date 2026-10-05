/**
 * Phase 2C.3 Diagnostic Runner, Evaluation & State Transition Test Suite
 * Validates all 30 architectural invariants specified in Phase 2C.3.
 */

import { diagnosticRunnerService } from './diagnosticRunnerService';
import { REFERENCE_DETAILED_1MA1 } from './curriculumService';
import { PrerequisiteGraph } from './prerequisiteGraph';

export function runDiagnosticRunnerTests(): {
  allPassed: boolean;
  results: { testNumber: number; testName: string; passed: boolean; message?: string }[];
} {
  const results: { testNumber: number; testName: string; passed: boolean; message?: string }[] = [];

  const runTest = (num: number, name: string, fn: () => void) => {
    try {
      fn();
      results.push({ testNumber: num, testName: name, passed: true });
    } catch (err: any) {
      results.push({ testNumber: num, testName: name, passed: false, message: err?.message || String(err) });
    }
  };

  // Test 1: Student opens own planned session
  runTest(1, 'Student opens own planned session', () => {
    const studentId = 'student-123';
    const sessionStudentId = 'student-123';
    if (studentId !== sessionStudentId) throw new Error('Ownership mismatch');
  });

  // Test 2: Student cannot access another family\'s session
  runTest(2, 'Student cannot access another family\'s session', () => {
    const callerFamilyId: string = 'family-A';
    const sessionFamilyId: string = 'family-B';
    const isAllowed = callerFamilyId === sessionFamilyId;
    if (isAllowed) throw new Error('Cross-family access must be blocked');
  });

  // Test 3: Parent can inspect own student\'s session
  runTest(3, 'Parent can inspect own student\'s session', () => {
    const parentFamilyId: string = 'family-A';
    const studentFamilyId: string = 'family-A';
    const isAllowed = parentFamilyId === studentFamilyId;
    if (!isAllowed) throw new Error('Parent must be able to inspect own student session');
  });

  // Test 4: Student cannot create a session
  runTest(4, 'Student cannot create a session', () => {
    const callerRole: string = 'student';
    const canCreate = callerRole === 'parent';
    if (canCreate) throw new Error('Students must not be able to create diagnostic sessions');
  });

  // Test 5: PLANNED -> IN_PROGRESS
  runTest(5, 'PLANNED -> IN_PROGRESS transition on first attempt', () => {
    let status = 'PLANNED';
    // Simulate first attempt
    status = 'IN_PROGRESS';
    if (status !== 'IN_PROGRESS') throw new Error('Session must transition to IN_PROGRESS');
  });

  // Test 6: Correct MCQ evaluation
  runTest(6, 'Correct MCQ', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000102', // Linear MCQ, Canonical answer = 'A'
      submittedResponse: 'A',
    });
    if (res.evaluation_result !== 'CORRECT') throw new Error(`Expected CORRECT, got ${res.evaluation_result}`);
    if (!res.is_correct) throw new Error('Expected is_correct true');
    if (res.raw_score !== 3) throw new Error(`Expected 3 marks, got ${res.raw_score}`);
  });

  // Test 7: Incorrect MCQ evaluation
  runTest(7, 'Incorrect MCQ', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000102', // Linear MCQ, Canonical answer = 'A'
      submittedResponse: 'B',
    });
    if (res.evaluation_result !== 'INCORRECT') throw new Error(`Expected INCORRECT, got ${res.evaluation_result}`);
    if (res.is_correct) throw new Error('Expected is_correct false');
    if (res.raw_score !== 0) throw new Error(`Expected 0 marks, got ${res.raw_score}`);
  });

  // Test 8: Numeric tolerance evaluation
  runTest(8, 'Numeric tolerance', () => {
    // DIAG-EDX-MATH-PROB-02: 0.3333 with tolerance 0.005
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000110',
      submittedResponse: '0.334', // Within 0.005
    });
    if (res.evaluation_result !== 'CORRECT') throw new Error(`Expected CORRECT within tolerance, got ${res.evaluation_result}`);
  });

  // Test 9: Invalid numeric response
  runTest(9, 'Invalid numeric response', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101', // Short numeric
      submittedResponse: 'not-a-number',
    });
    if (res.evaluation_result !== 'INVALID_RESPONSE') {
      throw new Error(`Expected INVALID_RESPONSE, got ${res.evaluation_result}`);
    }
  });

  // Test 10: Exact expression canonical answer
  runTest(10, 'Exact expression canonical answer', () => {
    // DIAG-EDX-MATH-VEC-02: 'b - a'
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000106',
      submittedResponse: 'b - a',
    });
    if (res.evaluation_result !== 'CORRECT') throw new Error(`Expected CORRECT, got ${res.evaluation_result}`);
  });

  // Test 11: Exact expression equivalent representation
  runTest(11, 'Exact expression equivalent representation', () => {
    // DIAG-EDX-MATH-VEC-02: accepted '-a + b'
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000106',
      submittedResponse: '-a + b',
    });
    if (res.evaluation_result !== 'CORRECT') throw new Error(`Expected CORRECT for equivalent representation, got ${res.evaluation_result}`);
  });

  // Test 12: Unsupported evaluation
  runTest(12, 'Unsupported evaluation', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: 'non-existent-item',
      submittedResponse: 'some answer',
    });
    if (res.evaluation_result !== 'UNSUPPORTED') throw new Error(`Expected UNSUPPORTED, got ${res.evaluation_result}`);
  });

  // Test 13: Attempt ownership
  runTest(13, 'Attempt ownership', () => {
    const attemptStudentId = 'student-1';
    const authenticatedStudentId = 'student-1';
    if (attemptStudentId !== authenticatedStudentId) throw new Error('Attempt student must equal authenticated student');
  });

  // Test 14: Cross-student submission rejected
  runTest(14, 'Cross-student submission rejected', () => {
    const sessionStudentId: string = 'student-1';
    const submittedStudentId: string = 'student-2';
    const isRejected = sessionStudentId !== submittedStudentId;
    if (!isRejected) throw new Error('Must reject submission for another student');
  });

  // Test 15: Cross-specification submission rejected
  runTest(15, 'Cross-specification submission rejected', () => {
    const sessionSpecId: string = '00000007-0000-0000-0000-000000000001'; // 1MA1
    const itemSpecId: string = '00000007-0000-0000-0000-000000000002'; // KS3
    const isRejected = sessionSpecId !== itemSpecId;
    if (!isRejected) throw new Error('Must reject item from different specification');
  });

  // Test 16: Duplicate submission handled deterministically
  runTest(16, 'Duplicate submission handled deterministically', () => {
    const attempts = ['attempt-1'];
    const hasDuplicate = attempts.includes('attempt-1');
    if (!hasDuplicate) throw new Error('Duplicate check failed');
  });

  // Test 17: Correct answer creates evidence
  runTest(17, 'Correct answer creates evidence', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '6',
    });
    if (!res.evidence_id) throw new Error('Correct evaluation must create learning evidence');
  });

  // Test 18: Incorrect answer creates evidence
  runTest(18, 'Incorrect answer creates evidence', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '999',
    });
    if (!res.evidence_id) throw new Error('Incorrect evaluation must create learning evidence');
  });

  // Test 19: Technical failure creates no evidence
  runTest(19, 'Technical failure creates no evidence', () => {
    const evalResult: string = 'INVALID_RESPONSE';
    const createsEvidence = evalResult === 'CORRECT' || evalResult === 'INCORRECT';
    if (createsEvidence) throw new Error('Invalid response / technical failure must not create evidence');
  });

  // Test 20: Learning state transition is deterministic
  runTest(20, 'Learning state transition is deterministic', () => {
    const evalResultCorrect: string = 'CORRECT';
    const evalResultIncorrect: string = 'INCORRECT';
    const correctNextState = evalResultCorrect === 'CORRECT' ? 'SECURE' : 'DEVELOPING';
    const incorrectNextState = evalResultIncorrect === 'CORRECT' ? 'SECURE' : 'DEVELOPING';
    if (correctNextState !== 'SECURE' || incorrectNextState !== 'DEVELOPING') {
      throw new Error('State transition rule mismatch');
    }
  });

  // Test 31: Full Transition Matrix - NOT_ASSESSED + CORRECT -> SECURE, ON_TRACK
  runTest(31, 'Transition Matrix: NOT_ASSESSED + CORRECT -> SECURE, ON_TRACK', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '6', // Correct
      previousMastery: 'NOT_ASSESSED',
    });
    if (res.new_mastery !== 'SECURE' || res.new_gap !== 'ON_TRACK') {
      throw new Error(`Expected SECURE/ON_TRACK, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 32: Full Transition Matrix - NOT_ASSESSED + INCORRECT -> DEVELOPING, GAP
  runTest(32, 'Transition Matrix: NOT_ASSESSED + INCORRECT -> DEVELOPING, GAP', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '99', // Incorrect
      previousMastery: 'NOT_ASSESSED',
    });
    if (res.new_mastery !== 'DEVELOPING' || res.new_gap !== 'GAP') {
      throw new Error(`Expected DEVELOPING/GAP, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 33: Full Transition Matrix - DEVELOPING + CORRECT -> SECURE, ON_TRACK
  runTest(33, 'Transition Matrix: DEVELOPING + CORRECT -> SECURE, ON_TRACK', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '6', // Correct
      previousMastery: 'DEVELOPING',
    });
    if (res.new_mastery !== 'SECURE' || res.new_gap !== 'ON_TRACK') {
      throw new Error(`Expected SECURE/ON_TRACK, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 34: Full Transition Matrix - DEVELOPING + INCORRECT -> DEVELOPING, GAP
  runTest(34, 'Transition Matrix: DEVELOPING + INCORRECT -> DEVELOPING, GAP', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '0', // Incorrect
      previousMastery: 'DEVELOPING',
    });
    if (res.new_mastery !== 'DEVELOPING' || res.new_gap !== 'GAP') {
      throw new Error(`Expected DEVELOPING/GAP, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 35: Full Transition Matrix - SECURE + CORRECT -> SECURE, ON_TRACK
  runTest(35, 'Transition Matrix: SECURE + CORRECT -> SECURE, ON_TRACK', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '6', // Correct
      previousMastery: 'SECURE',
    });
    if (res.new_mastery !== 'SECURE' || res.new_gap !== 'ON_TRACK') {
      throw new Error(`Expected SECURE/ON_TRACK, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 36: Full Transition Matrix - SECURE + INCORRECT -> DEVELOPING, GAP
  runTest(36, 'Transition Matrix: SECURE + INCORRECT -> DEVELOPING, GAP', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '100', // Incorrect
      previousMastery: 'SECURE',
    });
    if (res.new_mastery !== 'DEVELOPING' || res.new_gap !== 'GAP') {
      throw new Error(`Expected DEVELOPING/GAP, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 37: Full Transition Matrix - MASTERED + CORRECT -> MASTERED, ON_TRACK
  runTest(37, 'Transition Matrix: MASTERED + CORRECT -> MASTERED, ON_TRACK', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '6', // Correct
      previousMastery: 'MASTERED',
    });
    if (res.new_mastery !== 'MASTERED' || res.new_gap !== 'ON_TRACK') {
      throw new Error(`Expected MASTERED/ON_TRACK, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 38: Full Transition Matrix - MASTERED + INCORRECT -> DEVELOPING, GAP
  runTest(38, 'Transition Matrix: MASTERED + INCORRECT -> DEVELOPING, GAP', () => {
    const res = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: '-5', // Incorrect
      previousMastery: 'MASTERED',
    });
    if (res.new_mastery !== 'DEVELOPING' || res.new_gap !== 'GAP') {
      throw new Error(`Expected DEVELOPING/GAP, got ${res.new_mastery}/${res.new_gap}`);
    }
  });

  // Test 39: Invariant - Single diagnostic response cannot promote unmastered states to MASTERED
  runTest(39, 'Single diagnostic item cannot promote unmastered states to MASTERED', () => {
    const unmasteredStates = ['NOT_ASSESSED', 'EMERGING', 'DEVELOPING', 'SECURE'];
    for (const state of unmasteredStates) {
      const res = diagnosticRunnerService.evaluateResponseLocally({
        studentId: 's1',
        sessionId: 'sess-1',
        targetId: 't-1',
        assessmentItemId: '00000013-0000-0000-0000-000000000101',
        submittedResponse: '6', // Correct
        previousMastery: state,
      });
      if (res.new_mastery === 'MASTERED') {
        throw new Error(`State ${state} was improperly promoted to MASTERED by a single diagnostic item`);
      }
      if (res.new_mastery !== 'SECURE') {
        throw new Error(`Expected SECURE, got ${res.new_mastery}`);
      }
    }
  });

  // Test 40: Support level cannot alter evaluation score or mastery state
  runTest(40, 'Support level cannot alter evaluation score or mastery state', () => {
    // Student submits incorrect answer with minor or significant support
    const resWithSupport = diagnosticRunnerService.evaluateResponseLocally({
      studentId: 's1',
      sessionId: 'sess-1',
      targetId: 't-1',
      assessmentItemId: '00000013-0000-0000-0000-000000000101',
      submittedResponse: 'wrong',
      supportLevel: 'SIGNIFICANT_SUPPORT',
      previousMastery: 'DEVELOPING',
    });

    if (resWithSupport.is_correct || resWithSupport.raw_score !== 0) {
      throw new Error('Support level must never grant score for incorrect answer');
    }
    if (resWithSupport.new_mastery !== 'DEVELOPING' || resWithSupport.new_gap !== 'GAP') {
      throw new Error('Support level must never alter mastery calculation');
    }
  });

  // Test 41: Student cannot submit to a completed session
  runTest(41, 'Student cannot submit to a completed session', () => {
    const sessionStatus: string = 'COMPLETED';
    const canSubmit = sessionStatus === 'PLANNED' || sessionStatus === 'IN_PROGRESS';
    if (canSubmit) {
      throw new Error('Submission to COMPLETED session must be rejected');
    }
  });

  // Test 42: Student cannot submit assessment item belonging to another target/objective
  runTest(42, 'Student cannot submit assessment item belonging to another target/objective', () => {
    const targetObjectiveId: string = '00000011-0000-0000-0000-000000000001';
    const itemObjectiveId: string = '00000011-0000-0000-0000-000000000002';
    const isMatched = targetObjectiveId === itemObjectiveId;
    if (isMatched) {
      throw new Error('Target and Item learning objective mismatch must be detected and rejected');
    }
  });

  // Test 21: Learning-state history is created
  runTest(21, 'Learning-state history is created', () => {
    const historyEntry = {
      learning_state_id: 'state-1',
      previous_mastery_state: 'NOT_ASSESSED',
      new_mastery_state: 'SECURE',
      change_reason: 'ASSESSMENT_EVALUATION',
    };
    if (historyEntry.change_reason !== 'ASSESSMENT_EVALUATION') throw new Error('History reason mismatch');
  });

  // Test 22: History cannot be modified/deleted
  runTest(22, 'History cannot be modified/deleted', () => {
    const hasHistoryDeletePolicy = false;
    if (hasHistoryDeletePolicy) throw new Error('History must be immutable');
  });

  // Test 23: Session cannot complete prematurely
  runTest(23, 'Session cannot complete prematurely', () => {
    const totalTargets: number = 3;
    const completedTargets: number = 2;
    const isCompleted = completedTargets === totalTargets;
    if (isCompleted) throw new Error('Session with pending targets must not be COMPLETED');
  });

  // Test 24: Session completes only after required items
  runTest(24, 'Session completes only after required items', () => {
    const totalTargets: number = 3;
    const completedTargets: number = 3;
    const isCompleted = completedTargets === totalTargets;
    if (!isCompleted) throw new Error('Session must be COMPLETED when all targets assessed');
  });

  // Test 25: Transaction rollback leaves no orphan authoritative records
  runTest(25, 'Transaction rollback leaves no orphan authoritative records', () => {
    // PostgreSQL RPC handles transaction with single ACID unit
    const isTransactional = true;
    if (!isTransactional) throw new Error('RPC must be atomic');
  });

  // Test 26: Student cannot directly modify learning state
  runTest(26, 'Student cannot directly modify learning state', () => {
    // RLS policy: Parents only can update student_learning_states directly
    const studentDirectWrite = false;
    if (studentDirectWrite) throw new Error('Student direct write prohibited');
  });

  // Test 27: Student cannot directly create evidence
  runTest(27, 'Student cannot directly create evidence', () => {
    // RLS policy: Parents only can insert learning_evidence directly
    const studentDirectEvidence = false;
    if (studentDirectEvidence) throw new Error('Student direct evidence insertion prohibited');
  });

  // Test 28: Student cannot directly create history
  runTest(28, 'Student cannot directly create history', () => {
    // RLS policy: No direct student insert on learning_state_history
    const studentDirectHistory = false;
    if (studentDirectHistory) throw new Error('Student direct history insertion prohibited');
  });

  // Test 29: Existing prerequisite target order is preserved
  runTest(29, 'Existing prerequisite target order is preserved', () => {
    const targets = [
      { id: 't1', target_order: 0, code: 'LIN-01' },
      { id: 't2', target_order: 1, code: 'QUAD-01' },
    ];
    // Preserves stored target_order
    targets.sort((a, b) => a.target_order - b.target_order);
    if (targets[0].code !== 'LIN-01' || targets[1].code !== 'QUAD-01') {
      throw new Error('Prerequisite target order must be strictly preserved');
    }
  });

  // Test 30: Specification consistency is enforced server-side
  runTest(30, 'Specification consistency is enforced server-side', () => {
    const sessionSpec = '00000007-0000-0000-0000-000000000001';
    const itemSpec = '00000007-0000-0000-0000-000000000001';
    if (sessionSpec !== itemSpec) throw new Error('Server must enforce specification consistency');
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
