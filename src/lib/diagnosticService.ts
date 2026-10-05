/**
 * Diagnostic Service (Phase 2C.2)
 * Orchestrates deterministic prerequisite graph traversal, target selection,
 * and atomic diagnostic session generation.
 */

import { getSupabaseClient, isSupabaseReachable } from './supabase';
import { curriculumService } from './curriculumService';
import { databaseService } from './databaseService';
import { DiagnosticTargetPlan, PrerequisiteGraph, PrerequisiteGraphValidationResult } from './prerequisiteGraph';
import { DiagnosticSession } from '../types/database';

export interface SelectDiagnosticTargetsParams {
  studentId: string;
  studentSubjectId: string;
  targetObjectiveIds?: string[];
  includeRecommendedCoRequisites?: boolean;
  maxTargets?: number;
}

export interface CreatePlannedDiagnosticSessionParams {
  studentId: string;
  studentSubjectId: string;
  specificationId: string;
  title: string;
  purpose: string;
  targetPlans: DiagnosticTargetPlan[];
}

export interface PlannedDiagnosticSessionResult {
  session_id: string;
  student_id: string;
  title: string;
  status: 'PLANNED';
  target_count: number;
}

export const diagnosticService = {
  /**
   * Loads the prerequisite graph for a curriculum specification and performs DAG validation.
   */
  async getPrerequisiteGraphForSpecification(
    specificationId: string
  ): Promise<{ graph: PrerequisiteGraph; validation: PrerequisiteGraphValidationResult }> {
    const detail = await curriculumService.getSpecificationDetail(specificationId);
    if (!detail) {
      throw new Error(`Specification ID ${specificationId} not found in curriculum knowledge base.`);
    }

    // Flatten all concepts from topics
    const allConcepts: any[] = [];
    detail.topics.forEach((t) => {
      t.concepts.forEach((c) => {
        allConcepts.push(c);
      });
    });

    const graph = new PrerequisiteGraph(allConcepts);
    const validation = graph.validate();

    return { graph, validation };
  },

  /**
   * Deterministically selects diagnostic targets for a student's enrolled subject and tier.
   */
  async selectDiagnosticTargets(
    params: SelectDiagnosticTargetsParams
  ): Promise<DiagnosticTargetPlan[]> {
    const { studentId, studentSubjectId, targetObjectiveIds, includeRecommendedCoRequisites, maxTargets } = params;

    // 1. Fetch student subjects to verify context
    const subjects = await databaseService.getSubjectsForStudent(studentId);
    const subject = subjects.find((s: any) => s.id === studentSubjectId);

    if (!subject) {
      throw new Error(`Domain error: Student subject ${studentSubjectId} does not belong to student ${studentId}.`);
    }

    // 2. Enforce explicit specification binding (NO fallbacks!)
    if (!subject.specification_id) {
      throw new Error(
        `SPECIFICATION_NOT_CONFIGURED: Subject "${subject.subject_name}" has no bound specification_id. ` +
        `Diagnostic target selection requires an authoritative curriculum specification binding.`
      );
    }

    // 3. Load and validate the prerequisite graph for the specification
    const { graph, validation } = await this.getPrerequisiteGraphForSpecification(subject.specification_id);
    if (!validation.isValid) {
      throw new Error(
        `CYCLES_OR_CORRUPTION_DETECTED: Curriculum prerequisite graph validation failed:\n${validation.errors.join('\n')}`
      );
    }

    // 4. If targetObjectiveIds are not provided, select all available objectives for the specification
    let effectiveTargetIds = targetObjectiveIds;
    if (!effectiveTargetIds || effectiveTargetIds.length === 0) {
      const detail = await curriculumService.getSpecificationDetail(subject.specification_id);
      const allLoIds: string[] = [];
      detail?.topics.forEach((t) => {
        t.concepts.forEach((c) => {
          c.learning_objectives.forEach((lo) => {
            allLoIds.push(lo.id);
          });
        });
      });
      effectiveTargetIds = allLoIds;
    }

    // 5. Generate deterministic diagnostic plan with tier filtering
    const tierFilter = subject.tier || undefined;
    return graph.generateDiagnosticPlan({
      targetObjectiveIds: effectiveTargetIds,
      includeRecommendedCoRequisites: includeRecommendedCoRequisites ?? true,
      maxTargets,
      tierFilter,
    });
  },

  /**
   * Atomically creates a PLANNED diagnostic session with ordered diagnostic targets.
   * Invokes PostgreSQL RPC `create_diagnostic_session_with_targets`.
   */
  async createPlannedSession(
    params: CreatePlannedDiagnosticSessionParams
  ): Promise<PlannedDiagnosticSessionResult> {
    const { studentId, studentSubjectId, specificationId, title, purpose, targetPlans } = params;

    if (!targetPlans || targetPlans.length === 0) {
      throw new Error('Validation error: Cannot create a diagnostic session with 0 targets.');
    }

    const formattedTargets = targetPlans.map((plan) => ({
      learning_objective_id: plan.learning_objective_id,
      concept_id: plan.concept_id,
      target_order: plan.target_order,
      notes: `Depth ${plan.prerequisite_depth}: ${plan.inclusion_reason}${plan.relationship_type ? ` (${plan.relationship_type})` : ''}`,
    }));

    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase.rpc('create_diagnostic_session_with_targets', {
          p_student_id: studentId,
          p_student_subject_id: studentSubjectId,
          p_specification_id: specificationId,
          p_title: title,
          p_purpose: purpose,
          p_targets: formattedTargets,
        });

        if (error) {
          throw error;
        }

        return data as PlannedDiagnosticSessionResult;
      } catch (err: any) {
        console.warn('create_diagnostic_session_with_targets RPC fallback:', err);
        // If error was unauthorized or domain check, rethrow
        if (err?.message?.includes('Unauthorized') || err?.message?.includes('Domain error')) {
          throw err;
        }
      }
    }

    // Fallback: Local storage session creation for offline dev
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const localSession: DiagnosticSession = {
      id: sessionId,
      student_id: studentId,
      student_subject_id: studentSubjectId,
      specification_id: specificationId,
      title,
      purpose,
      status: 'PLANNED',
      created_at: now,
      updated_at: now,
    };

    const LOCAL_SESSIONS_KEY = 'homeedu_diagnostic_sessions';
    const LOCAL_TARGETS_KEY = 'homeedu_diagnostic_targets';

    const existingSessions: DiagnosticSession[] = JSON.parse(
      localStorage.getItem(LOCAL_SESSIONS_KEY) || '[]'
    );
    existingSessions.unshift(localSession);
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(existingSessions));

    const existingTargets: any[] = JSON.parse(
      localStorage.getItem(LOCAL_TARGETS_KEY) || '[]'
    );

    formattedTargets.forEach((t) => {
      existingTargets.push({
        id: crypto.randomUUID(),
        session_id: sessionId,
        learning_objective_id: t.learning_objective_id,
        concept_id: t.concept_id,
        target_order: t.target_order,
        status: 'PENDING',
        notes: t.notes,
        created_at: now,
      });
    });

    localStorage.setItem(LOCAL_TARGETS_KEY, JSON.stringify(existingTargets));

    return {
      session_id: sessionId,
      student_id: studentId,
      title,
      status: 'PLANNED',
      target_count: formattedTargets.length,
    };
  },
};
