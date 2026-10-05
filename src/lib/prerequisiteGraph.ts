/**
 * Prerequisite Graph Validation, Traversal & Deterministic Target Selection
 * Phase 2C.2 Core Engine
 *
 * Implements:
 * 1. DAG validation and cycle detection (DFS with recursion stack)
 * 2. Transitive prerequisite traversal (depth-first dependency resolution)
 * 3. Deterministic topological sorting with strict tie-breaking rules
 * 4. Concept -> Learning Objective expansion
 */

import { Concept, LearningObjective, PrerequisiteRelationship, PrerequisiteType } from '../types/curriculum';

export interface PrerequisiteGraphValidationResult {
  isValid: boolean;
  errors: string[];
  cycles: string[][];
}

export type DiagnosticInclusionReason = 'TARGET' | 'STRICT_PREREQUISITE' | 'RECOMMENDED_CO_REQUISITE';

export interface DiagnosticTargetPlan {
  learning_objective_id: string;
  learning_objective_code: string;
  learning_objective_statement: string;
  concept_id: string;
  concept_code: string;
  concept_title: string;
  target_order: number;
  prerequisite_depth: number;
  inclusion_reason: DiagnosticInclusionReason;
  relationship_type?: PrerequisiteType;
  tier_eligibility: string;
}

export interface PrerequisiteNode {
  concept: Concept;
  learningObjectives: LearningObjective[];
  prerequisites: {
    prerequisiteConceptId: string;
    relationshipType: PrerequisiteType;
    justification?: string;
  }[];
}

export class PrerequisiteGraph {
  private nodes = new Map<string, PrerequisiteNode>();
  private conceptByObjectiveId = new Map<string, string>();
  private objectiveById = new Map<string, LearningObjective>();

  constructor(
    concepts: (Concept & {
      learning_objectives?: LearningObjective[];
      prerequisites?: PrerequisiteRelationship[];
    })[],
    relationships?: PrerequisiteRelationship[]
  ) {
    // 1. Build Node Map
    concepts.forEach((c) => {
      const los = c.learning_objectives || [];
      this.nodes.set(c.id, {
        concept: c,
        learningObjectives: los,
        prerequisites: [],
      });

      los.forEach((lo) => {
        this.conceptByObjectiveId.set(lo.id, c.id);
        this.objectiveById.set(lo.id, lo);
      });
    });

    // 2. Attach prerequisite edges
    const allEdges = relationships || [];
    // Also include prerequisites embedded on concept objects if provided
    concepts.forEach((c) => {
      if (c.prerequisites) {
        c.prerequisites.forEach((p) => {
          if (!allEdges.some((e) => e.concept_id === p.concept_id && e.prerequisite_concept_id === p.prerequisite_concept_id)) {
            allEdges.push(p);
          }
        });
      }
    });

    allEdges.forEach((edge) => {
      const node = this.nodes.get(edge.concept_id);
      if (node) {
        // Prevent duplicate edges
        if (!node.prerequisites.some((p) => p.prerequisiteConceptId === edge.prerequisite_concept_id)) {
          node.prerequisites.push({
            prerequisiteConceptId: edge.prerequisite_concept_id,
            relationshipType: edge.relationship_type,
            justification: edge.justification,
          });
        }
      }
    });
  }

  /**
   * Validates the graph for structural integrity:
   * - Missing concept references
   * - Immediate self-loops (A -> A)
   * - Cycles of any length (A -> B -> A, A -> B -> C -> A, etc.)
   */
  public validate(): PrerequisiteGraphValidationResult {
    const errors: string[] = [];
    const cycles: string[][] = [];

    // 1. Check for references to missing concepts and self-loops
    for (const [conceptId, node] of this.nodes.entries()) {
      for (const prereq of node.prerequisites) {
        if (prereq.prerequisiteConceptId === conceptId) {
          errors.push(`Self-loop detected: Concept ${node.concept.code} (${conceptId}) cannot depend on itself.`);
        }
        if (!this.nodes.has(prereq.prerequisiteConceptId)) {
          errors.push(
            `Missing concept reference: Concept ${node.concept.code} depends on non-existent concept ID ${prereq.prerequisiteConceptId}.`
          );
        }
      }
    }

    // 2. Cycle Detection using DFS with recursion stack tracking
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (conceptId: string) => {
      visited.add(conceptId);
      inStack.add(conceptId);
      currentPath.push(conceptId);

      const node = this.nodes.get(conceptId);
      if (node) {
        for (const prereq of node.prerequisites) {
          const targetId = prereq.prerequisiteConceptId;
          if (!this.nodes.has(targetId)) continue;

          if (inStack.has(targetId)) {
            // Cycle found! Extract cycle path
            const cycleStartIndex = currentPath.indexOf(targetId);
            const cyclePathIds = [...currentPath.slice(cycleStartIndex), targetId];
            const cycleCodePath = cyclePathIds.map((id) => this.nodes.get(id)?.concept.code || id);
            cycles.push(cycleCodePath);
            errors.push(`Cycle detected in prerequisite graph: ${cycleCodePath.join(' -> ')}`);
          } else if (!visited.has(targetId)) {
            dfs(targetId);
          }
        }
      }

      currentPath.pop();
      inStack.delete(conceptId);
    };

    for (const conceptId of this.nodes.keys()) {
      if (!visited.has(conceptId)) {
        dfs(conceptId);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      cycles,
    };
  }

  /**
   * Deterministically selects and orders diagnostic targets for requested learning objectives.
   * Traversal direction: Upstream prerequisites are placed BEFORE dependants.
   *
   * Tie-Breaking Rule (Deterministic):
   * 1. prerequisite_depth (descending: deepest foundational prerequisite first)
   * 2. concept.code (alphanumeric ascending)
   * 3. learning_objective.code (alphanumeric ascending)
   */
  public generateDiagnosticPlan(params: {
    targetObjectiveIds: string[];
    includeRecommendedCoRequisites?: boolean;
    maxTargets?: number;
    tierFilter?: string;
  }): DiagnosticTargetPlan[] {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`Cannot generate diagnostic plan: Prerequisite graph has validation errors:\n${validation.errors.join('\n')}`);
    }

    const { targetObjectiveIds, includeRecommendedCoRequisites = true, maxTargets, tierFilter } = params;

    if (!targetObjectiveIds || targetObjectiveIds.length === 0) {
      return [];
    }

    // Concept ID -> metadata about its role in the diagnostic plan
    const collectedConcepts = new Map<
      string,
      {
        concept: Concept;
        depth: number;
        reason: DiagnosticInclusionReason;
        relationshipType?: PrerequisiteType;
      }
    >();

    // BFS/DFS exploration of upstream dependencies
    const traverseConcept = (
      conceptId: string,
      currentDepth: number,
      reason: DiagnosticInclusionReason,
      relType?: PrerequisiteType
    ) => {
      const node = this.nodes.get(conceptId);
      if (!node) return;

      const existing = collectedConcepts.get(conceptId);
      if (existing) {
        // If reached at a greater prerequisite depth, update depth
        if (currentDepth > existing.depth) {
          existing.depth = currentDepth;
        }
        // STRICT_PREREQUISITE overrides recommended or target status if found as dependency
        if (reason === 'STRICT_PREREQUISITE') {
          existing.reason = 'STRICT_PREREQUISITE';
          existing.relationshipType = 'STRICT_PREREQUISITE';
        }
      } else {
        collectedConcepts.set(conceptId, {
          concept: node.concept,
          depth: currentDepth,
          reason,
          relationshipType: relType,
        });
      }

      // Traverse upstream prerequisites
      for (const edge of node.prerequisites) {
        if (edge.relationshipType === 'STRICT_PREREQUISITE') {
          traverseConcept(edge.prerequisiteConceptId, currentDepth + 1, 'STRICT_PREREQUISITE', 'STRICT_PREREQUISITE');
        } else if (edge.relationshipType === 'RECOMMENDED_CO_REQUISITE' && includeRecommendedCoRequisites) {
          traverseConcept(edge.prerequisiteConceptId, currentDepth + 1, 'RECOMMENDED_CO_REQUISITE', 'RECOMMENDED_CO_REQUISITE');
        }
        // Note: DEVELOPMENTAL_EXTENSION is a downstream extension, so it is NOT traversed as an upstream prerequisite.
      }
    };

    // 1. Initialise traversal from requested target objectives
    targetObjectiveIds.forEach((loId) => {
      const conceptId = this.conceptByObjectiveId.get(loId);
      if (conceptId) {
        traverseConcept(conceptId, 0, 'TARGET');
      }
    });

    // 2. Expand Concepts to Learning Objectives
    const targetPlans: DiagnosticTargetPlan[] = [];

    for (const [conceptId, info] of collectedConcepts.entries()) {
      const node = this.nodes.get(conceptId);
      if (!node) continue;

      const los = node.learningObjectives;
      if (los.length === 0) {
        console.warn(`Concept ${info.concept.code} has no learning objectives defined.`);
        continue;
      }

      los.forEach((lo) => {
        // Filter by tier if specified (e.g. 'Foundation' excludes 'Higher' only objectives)
        if (tierFilter && tierFilter !== 'Not applicable') {
          if (tierFilter === 'Foundation' && lo.tier_eligibility === 'Higher') {
            return;
          }
        }

        // Determine specific inclusion reason for this objective
        const isDirectTarget = targetObjectiveIds.includes(lo.id);
        const effectiveReason: DiagnosticInclusionReason = isDirectTarget ? 'TARGET' : info.reason;

        targetPlans.push({
          learning_objective_id: lo.id,
          learning_objective_code: lo.code,
          learning_objective_statement: lo.statement,
          concept_id: conceptId,
          concept_code: info.concept.code,
          concept_title: info.concept.title,
          target_order: 0, // Will be set after sorting
          prerequisite_depth: info.depth,
          inclusion_reason: effectiveReason,
          relationship_type: info.relationshipType,
          tier_eligibility: lo.tier_eligibility,
        });
      });
    }

    // 3. Deterministic Topological Sorting & Tie-Breaking
    // Rule:
    // Primary: Depth descending (deepest prerequisite first: 2 -> 1 -> 0)
    // Secondary: Concept code alphanumeric ascending
    // Tertiary: Objective code alphanumeric ascending
    targetPlans.sort((a, b) => {
      if (a.prerequisite_depth !== b.prerequisite_depth) {
        return b.prerequisite_depth - a.prerequisite_depth;
      }
      if (a.concept_code !== b.concept_code) {
        return a.concept_code.localeCompare(b.concept_code);
      }
      return a.learning_objective_code.localeCompare(b.learning_objective_code);
    });

    // Assign sequential 0-indexed target_order
    targetPlans.forEach((plan, index) => {
      plan.target_order = index;
    });

    // Apply maximum target count if requested
    if (maxTargets && maxTargets > 0) {
      return targetPlans.slice(0, maxTargets);
    }

    return targetPlans;
  }
}
