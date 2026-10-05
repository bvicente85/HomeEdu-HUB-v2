import { AssessmentItem, AssessmentItemContent } from '../types/curriculum';
import { getSupabaseClient, isSupabaseReachable } from './supabase';
import { REFERENCE_DETAILED_1MA1 } from './curriculumService';

export interface AssessmentItemWithContent extends AssessmentItem {
  content_items: AssessmentItemContent[];
  active_content?: AssessmentItemContent;
}

export const assessmentItemService = {
  /**
   * Fetches all assessment items for a specification, along with their deliverable content.
   */
  async getAssessmentItemsForSpecification(
    specificationId: string
  ): Promise<AssessmentItemWithContent[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data: items, error: itemErr } = await supabase
          .from('assessment_items')
          .select('*')
          .eq('specification_id', specificationId)
          .order('item_reference', { ascending: true });

        if (!itemErr && items && items.length > 0) {
          const itemIds = items.map((i: AssessmentItem) => i.id);
          const { data: contents } = await supabase
            .from('assessment_item_content')
            .select('*')
            .in('assessment_item_id', itemIds);

          const contentMap = new Map<string, AssessmentItemContent[]>();
          (contents || []).forEach((c: AssessmentItemContent) => {
            const arr = contentMap.get(c.assessment_item_id) || [];
            arr.push(c);
            contentMap.set(c.assessment_item_id, arr);
          });

          return (items as AssessmentItem[]).map((item: AssessmentItem) => {
            const itemContents = contentMap.get(item.id) || [];
            return {
              ...item,
              content_items: itemContents,
              active_content: itemContents[0],
            };
          });
        }
      } catch (err) {
        console.warn('getAssessmentItemsForSpecification fallback:', err);
      }
    }

    // Fallback: Use verified seed items from curriculumService
    const localItems = (REFERENCE_DETAILED_1MA1.assessment_items || []).filter(
      (item: AssessmentItem) => item.specification_id === specificationId
    );

    return localItems.map((item: AssessmentItem) => ({
      ...item,
      content_items: item.content || [],
      active_content: item.content?.[0],
    }));
  },

  /**
   * Fetches diagnostic assessment items for a specific learning objective.
   */
  async getDiagnosticItemsForObjective(
    learningObjectiveId: string
  ): Promise<AssessmentItemWithContent[]> {
    if (isSupabaseReachable()) {
      try {
        const supabase = getSupabaseClient()!;
        const { data: items, error: itemErr } = await supabase
          .from('assessment_items')
          .select('*')
          .eq('learning_objective_id', learningObjectiveId)
          .order('item_reference', { ascending: true });

        if (!itemErr && items && items.length > 0) {
          const itemIds = items.map((i: AssessmentItem) => i.id);
          const { data: contents } = await supabase
            .from('assessment_item_content')
            .select('*')
            .in('assessment_item_id', itemIds);

          const contentMap = new Map<string, AssessmentItemContent[]>();
          (contents || []).forEach((c: AssessmentItemContent) => {
            const arr = contentMap.get(c.assessment_item_id) || [];
            arr.push(c);
            contentMap.set(c.assessment_item_id, arr);
          });

          return (items as AssessmentItem[]).map((item: AssessmentItem) => {
            const itemContents = contentMap.get(item.id) || [];
            return {
              ...item,
              content_items: itemContents,
              active_content: itemContents[0],
            };
          });
        }
      } catch (err) {
        console.warn('getDiagnosticItemsForObjective fallback:', err);
      }
    }

    const localItems = (REFERENCE_DETAILED_1MA1.assessment_items || []).filter(
      (item: AssessmentItem) => item.learning_objective_id === learningObjectiveId
    );

    return localItems.map((item: AssessmentItem) => ({
      ...item,
      content_items: item.content || [],
      active_content: item.content?.[0],
    }));
  },
};
