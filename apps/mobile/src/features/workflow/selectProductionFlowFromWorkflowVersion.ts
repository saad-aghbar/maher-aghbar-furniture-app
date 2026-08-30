import { localizedName } from '@maher/i18n';
import type { WorkflowNode, WorkflowVersion } from '@/api/modules/workflow';
import type { ProductionFlowStage } from '@/features/production-flow/selectProductionFlow';
import { asLocale } from './trilingualNames';
import { toDomainGraph } from './toDomainGraph';

type NodeWithStage = WorkflowNode & {
  stageDefinition: NonNullable<WorkflowNode['stageDefinition']>;
};

function hasStageDefinition(node: WorkflowNode): node is NodeWithStage {
  return Boolean(node?.stageDefinition?.id && node.stageDefinition.code);
}

/**
 * Map a workflow template version into ProductionFlowMap stages.
 * Uses the sole canonical domain graph (no separate heal path).
 */
export function selectProductionFlowFromWorkflowVersion(
  version: WorkflowVersion,
  locale = 'en',
  estimatesByStageDefId?: Map<string, number>,
): ProductionFlowStage[] {
  const loc = asLocale(locale);
  const nodes = (version.nodes ?? []).filter(hasStageDefinition);
  const graph = toDomainGraph(version);

  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node, index) => {
      const stageCode = node.stageDefinition.code;
      const isDelivery = stageCode.toUpperCase() === 'DELIVERY';
      const estimatedMinutes = isDelivery
        ? null
        : (estimatesByStageDefId?.get(node.stageDefinition.id) ?? null);
      return {
        code: node.id,
        name: localizedName(loc, node.stageDefinition, stageCode),
        status: estimatedMinutes && estimatedMinutes > 0 ? 'READY' : 'PENDING',
        progressPercent: 0,
        dependsOnCodes: [...(graph.predecessorsByNode[node.id] ?? [])],
        sortOrder: index,
        stageDefinitionId: node.stageDefinition.id,
        estimatedMinutes,
        estimateReviewRequired: !(estimatedMinutes && estimatedMinutes > 0),
        assignees: [],
        actualStart: null,
        actualEnd: null,
        plannedEnd: null,
        isOverdue: false,
        blockers: [],
        notes: null,
        attachmentCount: 0,
        photos: [],
      };
    });
}
