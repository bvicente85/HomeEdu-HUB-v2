/**
 * Learning Impact & Prerequisite Gap Interpretation Service (Phase 2D.1)
 *
 * Deterministic, server-authoritative read-only projection that interprets
 * student learning states against the verified curriculum prerequisite DAG.
 *
 * INVARIANTS:
 * 1. Read-only projection: Never modifies student_learning_states, learning_evidence, or history.
 * 2. NOT_ASSESSED / NO_DATA != GAP. Absence of evidence is never treated as failure.
 * 3. Prerequisite blockers are derived graph impacts, never fabricated student evidence.
 * 4. Only STRICT_PREREQUISITE creates a blocking dependency.
 * 5. Full determinism and specification isolation.
 */

import { Concept, LearningObjective, PrerequisiteRelationship, SpecificationDetail } from '../types/curriculum';
import { StudentLearningState } from '../types/learningState';
import { curriculumService, REFERENCE_DETAILED_1MA1 } from './curriculumService';
import { learningStateService } from './learningStateService';
import { getSupabaseClient, isSupabaseReachable } from './supabase';

export type PrerequisiteReadiness =
  | 'SATISFIED' // All strict prerequisites are SECURE or MASTERED (or no prerequisites)
  | 'UNVERIFIED' // One or more strict prerequisites are NOT_ASSESSED (no active gap, but unverified)
  | 'BLOCKED'; // One or more strict prerequisites have state DEVELOPING / GAP

export type GapClassification =
  | 'DIRECT_GAP' // Student demonstrated misconception on this objective (DEVELOPING / GAP)
  | 'PREREQUISITE_BLOCKED' // Objective has an upstream strict prerequisite with a DIRECT_GAP
  | 'UNASSESSED_FOUNDATIONAL' // Unassessed objective with all prerequisites satisfied (ready for baseline assessment)
  | 'UNASSESSED_BLOCKED' // Unassessed objective blocked by upstream prerequisite gap
  | 'UNASSESSED_UNVERIFIED' // Unassessed objective whose prerequisites are also unassessed
  | 'ON_TRACK' // Objective is SECURE or MASTERED with prerequisites satisfied
  | 'NO_DATA'; // Unassessed baseline state

export interface BlockingPrerequisiteLink {
  concept_id: string;
  concept_code: string;
  concept_title: string;
  learning_objective_id: string;
  learning_objective_code: string;
  mastery_state: string;
  gap_status: string;
  depth: number;
  blocked_by?: BlockingPrerequisiteLink[];
}

export interface DownstreamImpactInfo {
  direct_downstream_concept_count: number;
  direct_downstream_objective_count: number;
  transitive_downstream_concept_count: number;
  transitive_downstream_objective_count: number;
  direct_downstream_objective_codes: string[];
  transitive_downstream_objective_codes: string[];
  is_blocking_downstream: boolean;
}

export interface ObjectivePrerequisiteImpact {
  learning_objective_id: string;
  learning_objective_code: string;
  learning_objective_statement: string;
  concept_id: string;
  concept_code: string;
  concept_title: string;
  topic_id: string;
  topic_title: string;
  specification_id: string;
  tier_eligibility: string;

  // Authoritative Student State (Factual Observation / Ledger Record)
  authoritative_mastery_state: string;
  authoritative_gap_status: string;
  evidence_count: number;
  confidence_level?: string;
  last_assessed_at?: string;

  // Derived Intelligence (Pure Projection)
  gap_classification: GapClassification;
  prerequisite_readiness: PrerequisiteReadiness;
  has_direct_gap: boolean;
  is_prerequisite_blocked: boolean;
  blocking_chain: BlockingPrerequisiteLink[];
  downstream_impact: DownstreamImpactInfo;
}

export interface SubjectPrerequisiteImpactReport {
  student_id: string;
  student_subject_id?: string;
  specification_id: string;
  specification_name: string;
  total_objectives: number;
  direct_gaps_count: number;
  prerequisite_blocked_count: number;
  unassessed_foundational_count: number;
  secure_count: number;
  mastered_count: number;
  objectives: ObjectivePrerequisiteImpact[];
  evaluated_at: string;
}

export const learningImpactService = {
  /**
   * Generates a deterministic prerequisite impact & gap report for a student subject.
   */
  async generateSubjectImpactReport(params: {
    studentId: string;
    studentSubjectId?: string;
    specificationId: string;
    mockLearningStates?: StudentLearningState[];
  }): Promise<SubjectPrerequisiteImpactReport> {
    const { studentId, studentSubjectId, specificationId, mockLearningStates } = params;

    if (!specificationId || typeof specificationId !== 'string' || specificationId.trim() === '') {
      throw new Error('Domain error: Student subject is not bound to a valid specification.');
    }

    // 1. Load Specification Knowledge Base Detail
    let specDetail: SpecificationDetail | null = null;
    try {
      specDetail = await curriculumService.getSpecificationDetail(specificationId);
    } catch {
      // Fallback to reference 1MA1 if matches ID
      if (specificationId === REFERENCE_DETAILED_1MA1.id || specificationId === '1MA1') {
        specDetail = REFERENCE_DETAILED_1MA1;
      }
    }

    if (!specDetail || specDetail.id !== specificationId) {
      if (specificationId === REFERENCE_DETAILED_1MA1.id) {
        specDetail = REFERENCE_DETAILED_1MA1;
      } else {
        throw new Error(`Domain error: Specification ${specificationId} not found.`);
      }
    }

    // 2. Load Student Learning States (or use provided mock states for deterministic testing)
    let states: StudentLearningState[] = [];
    if (mockLearningStates) {
      states = mockLearningStates;
    } else {
      states = await learningStateService.getLearningStatesForStudent(studentId);
    }

    const stateByLoId = new Map<string, StudentLearningState>();
    states.forEach((s) => {
      stateByLoId.set(s.learning_objective_id, s);
    });

    // 3. Extract curriculum entities for this specification
    const allConcepts: Concept[] = [];
    const allObjectives: (LearningObjective & { topic_title: string; sort_order: number })[] = [];
    const strictPrereqEdges: { concept_id: string; prerequisite_concept_id: string }[] = [];
    const reverseStrictEdges = new Map<string, string[]>(); // PrereqConceptId -> DependentConceptIds[]
    const conceptById = new Map<string, Concept>();
    const conceptByObjectiveId = new Map<string, string>();
    const objectivesByConceptId = new Map<string, LearningObjective[]>();

    specDetail.topics.forEach((topic) => {
      topic.concepts.forEach((c) => {
        allConcepts.push(c);
        conceptById.set(c.id, c);

        const los = c.learning_objectives || [];
        objectivesByConceptId.set(c.id, los);

        los.forEach((lo) => {
          allObjectives.push({
            ...lo,
            topic_title: topic.title,
            sort_order: topic.sort_order,
          });
          conceptByObjectiveId.set(lo.id, c.id);
        });

        if (c.prerequisites) {
          c.prerequisites.forEach((p) => {
            if (p.relationship_type === 'STRICT_PREREQUISITE') {
              strictPrereqEdges.push({
                concept_id: p.concept_id,
                prerequisite_concept_id: p.prerequisite_concept_id,
              });

              const existingRev = reverseStrictEdges.get(p.prerequisite_concept_id) || [];
              existingRev.push(p.concept_id);
              reverseStrictEdges.set(p.prerequisite_concept_id, existingRev);
            }
          });
        }
      });
    });

    // Helper: Upstream Strict Prerequisite Concepts
    const getUpstreamStrictPrereqs = (conceptId: string): string[] => {
      return strictPrereqEdges
        .filter((e) => e.concept_id === conceptId)
        .map((e) => e.prerequisite_concept_id);
    };

    // Helper: Transitive Downstream Dependent Concepts
    const getTransitiveDownstreamConcepts = (startConceptId: string): string[] => {
      const visited = new Set<string>();
      const queue = [...(reverseStrictEdges.get(startConceptId) || [])];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (!visited.has(curr)) {
          visited.add(curr);
          const nextDownstream = reverseStrictEdges.get(curr) || [];
          nextDownstream.forEach((dep) => {
            if (!visited.has(dep)) queue.push(dep);
          });
        }
      }

      return Array.from(visited);
    };

    // 4. Recursive Blocker Traversal
    const buildBlockingChain = (
      conceptId: string,
      currentDepth: number,
      visitedConcepts = new Set<string>()
    ): BlockingPrerequisiteLink[] => {
      if (visitedConcepts.has(conceptId)) return [];
      visitedConcepts.add(conceptId);

      const upstreamConceptIds = getUpstreamStrictPrereqs(conceptId);
      const chain: BlockingPrerequisiteLink[] = [];

      for (const upId of upstreamConceptIds) {
        const upConcept = conceptById.get(upId);
        if (!upConcept) continue;

        const upLOs = objectivesByConceptId.get(upId) || [];
        for (const lo of upLOs) {
          const loState = stateByLoId.get(lo.id);
          const isGap = loState?.mastery_state === 'DEVELOPING' || loState?.gap_status === 'GAP';

          // Upstream blockers of this prerequisite
          const deeperBlockers = buildBlockingChain(upId, currentDepth + 1, new Set(visitedConcepts));

          if (isGap || deeperBlockers.length > 0) {
            chain.push({
              concept_id: upConcept.id,
              concept_code: upConcept.code,
              concept_title: upConcept.title,
              learning_objective_id: lo.id,
              learning_objective_code: lo.code,
              mastery_state: loState?.mastery_state || 'NOT_ASSESSED',
              gap_status: loState?.gap_status || 'NO_DATA',
              depth: currentDepth,
              blocked_by: deeperBlockers.length > 0 ? deeperBlockers : undefined,
            });
          }
        }
      }

      return chain;
    };

    // 5. Evaluate every Objective deterministically
    const evaluatedObjectives: ObjectivePrerequisiteImpact[] = [];

    for (const lo of allObjectives) {
      const concept = conceptById.get(lo.concept_id)!;
      const loState = stateByLoId.get(lo.id);

      const masteryState = loState?.mastery_state || 'NOT_ASSESSED';
      const gapStatus = loState?.gap_status || 'NO_DATA';
      const hasDirectGap = masteryState === 'DEVELOPING' || gapStatus === 'GAP';

      // Evaluate upstream prerequisites
      const upstreamPrereqConceptIds = getUpstreamStrictPrereqs(concept.id);
      const blockingChain = buildBlockingChain(concept.id, 1);
      const isPrerequisiteBlocked = blockingChain.length > 0;

      // Determine prerequisite readiness
      let prereqReadiness: PrerequisiteReadiness = 'SATISFIED';
      if (isPrerequisiteBlocked) {
        prereqReadiness = 'BLOCKED';
      } else if (upstreamPrereqConceptIds.length > 0) {
        // Check if all upstream strict prerequisites are SECURE or MASTERED
        let allSatisfied = true;
        for (const upId of upstreamPrereqConceptIds) {
          const upLOs = objectivesByConceptId.get(upId) || [];
          for (const upLO of upLOs) {
            const upState = stateByLoId.get(upLO.id);
            const isSecureOrMastered =
              upState?.mastery_state === 'SECURE' || upState?.mastery_state === 'MASTERED';
            if (!isSecureOrMastered) {
              allSatisfied = false;
              break;
            }
          }
          if (!allSatisfied) break;
        }

        prereqReadiness = allSatisfied ? 'SATISFIED' : 'UNVERIFIED';
      }

      // Determine derived gap classification
      let gapClassification: GapClassification = 'NO_DATA';

      if (hasDirectGap) {
        gapClassification = 'DIRECT_GAP';
      } else if (isPrerequisiteBlocked) {
        gapClassification = masteryState === 'NOT_ASSESSED' ? 'UNASSESSED_BLOCKED' : 'PREREQUISITE_BLOCKED';
      } else if (masteryState === 'NOT_ASSESSED') {
        gapClassification =
          prereqReadiness === 'SATISFIED' ? 'UNASSESSED_FOUNDATIONAL' : 'UNASSESSED_UNVERIFIED';
      } else if (masteryState === 'SECURE' || masteryState === 'MASTERED') {
        gapClassification = 'ON_TRACK';
      } else {
        gapClassification = 'NO_DATA';
      }

      // Compute Downstream Impact Info
      const directDownstreamConceptIds = reverseStrictEdges.get(concept.id) || [];
      const transitiveDownstreamConceptIds = getTransitiveDownstreamConcepts(concept.id);

      const directDownstreamLOs: string[] = [];
      directDownstreamConceptIds.forEach((cId) => {
        (objectivesByConceptId.get(cId) || []).forEach((dLo) => directDownstreamLOs.push(dLo.code));
      });

      const transitiveDownstreamLOs: string[] = [];
      transitiveDownstreamConceptIds.forEach((cId) => {
        (objectivesByConceptId.get(cId) || []).forEach((tLo) => transitiveDownstreamLOs.push(tLo.code));
      });

      const downstreamImpact: DownstreamImpactInfo = {
        direct_downstream_concept_count: directDownstreamConceptIds.length,
        direct_downstream_objective_count: directDownstreamLOs.length,
        transitive_downstream_concept_count: transitiveDownstreamConceptIds.length,
        transitive_downstream_objective_count: transitiveDownstreamLOs.length,
        direct_downstream_objective_codes: directDownstreamLOs.sort(),
        transitive_downstream_objective_codes: transitiveDownstreamLOs.sort(),
        is_blocking_downstream: hasDirectGap && transitiveDownstreamConceptIds.length > 0,
      };

      evaluatedObjectives.push({
        learning_objective_id: lo.id,
        learning_objective_code: lo.code,
        learning_objective_statement: lo.statement,
        concept_id: concept.id,
        concept_code: concept.code,
        concept_title: concept.title,
        topic_id: concept.topic_id,
        topic_title: lo.topic_title,
        specification_id: specificationId,
        tier_eligibility: lo.tier_eligibility,

        authoritative_mastery_state: masteryState,
        authoritative_gap_status: gapStatus,
        evidence_count: loState?.evidence_count || 0,
        confidence_level: loState?.confidence_level || undefined,
        last_assessed_at: loState?.last_assessed_at || undefined,

        gap_classification: gapClassification,
        prerequisite_readiness: prereqReadiness,
        has_direct_gap: hasDirectGap,
        is_prerequisite_blocked: isPrerequisiteBlocked,
        blocking_chain: blockingChain,
        downstream_impact: downstreamImpact,
      });
    }

    // 6. Stable, deterministic sorting (Topic sort_order ASC, Concept code ASC, LO code ASC)
    evaluatedObjectives.sort((a, b) => {
      const topicA = allObjectives.find((o) => o.id === a.learning_objective_id)?.sort_order || 0;
      const topicB = allObjectives.find((o) => o.id === b.learning_objective_id)?.sort_order || 0;
      if (topicA !== topicB) return topicA - topicB;
      const conceptCmp = a.concept_code.localeCompare(b.concept_code);
      if (conceptCmp !== 0) return conceptCmp;
      return a.learning_objective_code.localeCompare(b.learning_objective_code);
    });

    const directGapsCount = evaluatedObjectives.filter((o) => o.has_direct_gap).length;
    const prereqBlockedCount = evaluatedObjectives.filter((o) => o.is_prerequisite_blocked).length;
    const unassessedFoundationalCount = evaluatedObjectives.filter(
      (o) => o.gap_classification === 'UNASSESSED_FOUNDATIONAL'
    ).length;
    const secureCount = evaluatedObjectives.filter(
      (o) => o.authoritative_mastery_state === 'SECURE'
    ).length;
    const masteredCount = evaluatedObjectives.filter(
      (o) => o.authoritative_mastery_state === 'MASTERED'
    ).length;

    return {
      student_id: studentId,
      student_subject_id: studentSubjectId,
      specification_id: specificationId,
      specification_name: specDetail.title,
      total_objectives: evaluatedObjectives.length,
      direct_gaps_count: directGapsCount,
      prerequisite_blocked_count: prereqBlockedCount,
      unassessed_foundational_count: unassessedFoundationalCount,
      secure_count: secureCount,
      mastered_count: masteredCount,
      objectives: evaluatedObjectives,
      evaluated_at: new Date().toISOString(),
    };
  },
};
