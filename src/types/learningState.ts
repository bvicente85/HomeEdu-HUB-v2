/**
 * Student Learning State & Diagnostic Baseline Architecture Types (Phase 2B)
 *
 * Implements fine-grained pedagogical state tracking:
 * - Decouples categorical mastery from single percentage scores
 * - Separates mastery state from prerequisite gap identification
 * - Represents evidence reliability and support level explicitly
 * - Preserves immutable audit history for state transitions
 */

import { LearningObjective, Concept, PrerequisiteRelationship } from './curriculum';

export type MasteryState =
  | 'NOT_ASSESSED'
  | 'EMERGING'
  | 'DEVELOPING'
  | 'SECURE'
  | 'MASTERED';

export type GapStatus =
  | 'NO_DATA'
  | 'ON_TRACK'
  | 'DEVELOPING'
  | 'GAP'
  | 'PREREQUISITE_GAP';

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type SupportLevel =
  | 'INDEPENDENT'
  | 'MINOR_SUPPORT'
  | 'SIGNIFICANT_SUPPORT';

export type EvidenceType =
  | 'DIAGNOSTIC_ASSESSMENT'
  | 'LEARNING_ACTIVITY'
  | 'EXERCISE'
  | 'WRITTEN_WORK'
  | 'PARENT_OBSERVATION'
  | 'TUTOR_ASSESSMENT'
  | 'PARENT_OVERRIDE';

export type EvidenceResultStatus =
  | 'DEMONSTRATED'
  | 'PARTIALLY_DEMONSTRATED'
  | 'NOT_DEMONSTRATED';

export type DiagnosticSessionStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type DiagnosticTargetStatus = 'PENDING' | 'ASSESSED' | 'SKIPPED';

export type AssessmentAttemptResult =
  | 'CORRECT'
  | 'PARTIALLY_CORRECT'
  | 'INCORRECT';

export type ChangeReason =
  | 'INITIAL_STATE'
  | 'ASSESSMENT_EVALUATION'
  | 'EVIDENCE_RECORDED'
  | 'PARENT_OVERRIDE'
  | 'PREREQUISITE_ANALYSIS'
  | 'MANUAL_ADJUSTMENT';

/**
 * Core Student Learning State linked directly to a Learning Objective
 */
export interface StudentLearningState {
  id: string;
  student_id: string;
  learning_objective_id: string;
  mastery_state: MasteryState;
  gap_status: GapStatus;
  evidence_count: number;
  last_assessed_at?: string | null;
  last_demonstrated_at?: string | null;
  confidence_level: ConfidenceLevel;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Diagnostic Assessment Session representing a planned or completed diagnostic baseline
 */
export interface DiagnosticSession {
  id: string;
  student_id: string;
  student_subject_id?: string | null;
  specification_id?: string | null;
  title: string;
  status: DiagnosticSessionStatus;
  purpose?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Target within a Diagnostic Session (Objective or Concept)
 */
export interface DiagnosticTarget {
  id: string;
  session_id: string;
  learning_objective_id?: string | null;
  concept_id?: string | null;
  target_order: number;
  status: DiagnosticTargetStatus;
  notes?: string | null;
  created_at: string;
  // Hydrated join fields (optional)
  learning_objective?: LearningObjective;
  concept?: Concept;
}

/**
 * Concrete Learning Evidence piece
 */
export interface LearningEvidence {
  id: string;
  student_id: string;
  learning_objective_id: string;
  evidence_type: EvidenceType;
  support_level: SupportLevel;
  result_status: EvidenceResultStatus;
  reliability: ConfidenceLevel;
  source_reference?: string | null;
  captured_at: string;
  notes?: string | null;
  created_at: string;
}

/**
 * Individual Assessment Attempt on an objective or specific assessment item
 */
export interface AssessmentAttempt {
  id: string;
  student_id: string;
  learning_objective_id: string;
  diagnostic_session_id?: string | null;
  assessment_item_id?: string | null;
  attempted_at: string;
  result: AssessmentAttemptResult;
  raw_score?: number | null;
  max_score?: number | null;
  support_level: SupportLevel;
  evidence_id?: string | null;
  notes?: string | null;
  created_at: string;
}

/**
 * Immutable State Transition History Record
 */
export interface LearningStateHistory {
  id: string;
  learning_state_id: string;
  student_id: string;
  learning_objective_id: string;
  previous_mastery_state?: MasteryState | null;
  new_mastery_state: MasteryState;
  previous_gap_status?: GapStatus | null;
  new_gap_status: GapStatus;
  change_reason: ChangeReason;
  evidence_id?: string | null;
  notes?: string | null;
  created_at: string;
}

/**
 * Composite view of a Learning Objective with active student state & prerequisites
 */
export interface LearningObjectiveWithState extends LearningObjective {
  state?: StudentLearningState | null;
  concept?: Concept;
  prerequisites?: (PrerequisiteRelationship & { prerequisite_concept?: Concept })[];
  evidence?: LearningEvidence[];
  history?: LearningStateHistory[];
}
