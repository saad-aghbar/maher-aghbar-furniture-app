import { localizedName } from '@maher/i18n';
import type { WorkflowNode, WorkflowVersion } from '@/api/modules/workflow';
import type { ProductionFlowStage } from '@/features/production-flow/selectProductionFlow';
import { asLocale } from './trilingualNames';

type NodeWithStage = WorkflowNode & {
  stageDefinition: NonNullable<WorkflowNode['stageDefinition']>;
};

function hasStageDefinition(node: WorkflowNode): node is NodeWithStage {
  return Boolean(node?.stageDefinition?.id && node.stageDefinition.code);
}

/**
 * Map a workflow template version into ProductionFlowMap stages (read-only preview),
 * optionally overlaying per-product stage estimate minutes.
 */
export function selectProductionFlowFromWorkflowVersion(
  version: WorkflowVersion,
  locale = 'en',
  estimatesByStageDefId?: Map<string, number>,
): ProductionFlowStage[] {
  const loc = asLocale(locale);
  const nodes = (version.nodes ?? []).filter(hasStageDefinition);
  const idToCode = new Map(nodes.map((n) => [n.id, n.stageDefinition.code] as const));

  const dependsByCode = new Map<string, string[]>();
  for (const edge of version.edges ?? []) {
    const from = idToCode.get(edge.fromNodeId);
    const to = idToCode.get(edge.toNodeId);
    if (!from || !to) continue;
    const list = dependsByCode.get(to) ?? [];
    list.push(from);
    dependsByCode.set(to, list);
  }

  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node, index) => {
      const code = node.stageDefinition.code;
      const estimatedMinutes = estimatesByStageDefId?.get(node.stageDefinition.id) ?? null;
      return {
        code,
        name: localizedName(loc, node.stageDefinition, code),
        status: estimatedMinutes && estimatedMinutes > 0 ? 'READY' : 'PENDING',
        progressPercent: 0,
        dependsOnCodes: dependsByCode.get(code) ?? [],
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
      } satisfies ProductionFlowStage;
    });
}
