import { localizedName } from '@maher/i18n';
import { stageEstimateMinutes, type ProductStageEstimate } from '@/api/modules/scheduling';
import type { WorkflowNode, WorkflowVersion } from '@/api/modules/workflow';
import type { ProductionFlowStage } from '@/features/production-flow/selectProductionFlow';
import { asLocale } from './trilingualNames';
import { toDomainGraph } from './toDomainGraph';
import { isDeliverySetupStage, isQualityGateSetupStage } from './productionSetupBehavior';

type NamedStageDef = {
  id: string;
  code: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

type NodeWithStage = WorkflowNode & {
  stageDefinition: NonNullable<WorkflowNode['stageDefinition']>;
};

function hasStageDefinition(node: WorkflowNode): node is NodeWithStage {
  return Boolean(node?.stageDefinition?.id && node.stageDefinition.code);
}

function toPreviewStage(
  def: NamedStageDef,
  locale: string,
  estimatedMinutes: number | null,
  dependsOnCodes: string[],
  sortOrder: number,
): ProductionFlowStage {
  const milestone = isQualityGateSetupStage(def.code) || isDeliverySetupStage(def.code);
  const timed = Boolean(estimatedMinutes && estimatedMinutes > 0);
  return {
    code: def.code,
    name: localizedName(locale, def, def.code),
    status: timed || milestone ? 'READY' : 'PENDING',
    progressPercent: 0,
    dependsOnCodes,
    sortOrder,
    stageDefinitionId: def.id,
    estimatedMinutes: isQualityGateSetupStage(def.code) ? 0 : estimatedMinutes,
    estimateReviewRequired: milestone ? false : !timed,
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
      const isDelivery = isDeliverySetupStage(stageCode);
      const qualityGate = isQualityGateSetupStage(stageCode);
      const estimatedMinutes = isDelivery
        ? null
        : qualityGate
          ? 0
          : (estimatesByStageDefId?.get(node.stageDefinition.id) ?? null);
      const milestone = isDelivery || qualityGate;
      const timed = Boolean(estimatedMinutes && estimatedMinutes > 0);
      return {
        code: node.id,
        name: localizedName(loc, node.stageDefinition, stageCode),
        status: timed || milestone ? 'READY' : 'PENDING',
        progressPercent: 0,
        dependsOnCodes: [...(graph.predecessorsByNode[node.id] ?? [])],
        sortOrder: index,
        stageDefinitionId: node.stageDefinition.id,
        estimatedMinutes,
        estimateReviewRequired: milestone ? false : !timed,
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

/**
 * Fallback when the product has persisted stage estimates but the workflow graph
 * is missing from the route. Names and times come from the API — never invented.
 */
export function selectProductionFlowFromStageEstimates(
  rows: ProductStageEstimate[],
  locale = 'en',
): ProductionFlowStage[] {
  const loc = asLocale(locale);
  return [...rows]
    .filter((row) => Boolean(row.stageDefinition?.id && row.stageDefinition.code))
    .sort(
      (a, b) => (a.stageDefinition?.sortOrder ?? 0) - (b.stageDefinition?.sortOrder ?? 0),
    )
    .map((row, index) => {
      const def = row.stageDefinition!;
      const minutes = stageEstimateMinutes(row);
      return toPreviewStage(def, loc, minutes > 0 ? minutes : null, [], index);
    });
}

/** SKU / localized name, skipping a duplicate when the name is just the SKU. */
export function formatProductIdentity(
  sku?: string | null,
  name?: string | null,
): string {
  const code = sku?.trim() ?? '';
  const label = name?.trim() ?? '';
  if (code && label && code !== label) return `${code} / ${label}`;
  return code || label;
}
