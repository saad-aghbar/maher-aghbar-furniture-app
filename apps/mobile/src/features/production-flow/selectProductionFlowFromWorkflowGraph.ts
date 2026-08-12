import { localizedName } from '@maher/i18n';
import type { OrderWorkflowGraph } from '@/api/modules/workflow';
import type { ProductionFlowModel, ProductionFlowRole, ProductionFlowStage } from './selectProductionFlow';
import { enforceDealerStageStrip } from './selectProductionFlow';

function asLocale(locale: string) {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

function dependsOnCodesForStage(
  code: string,
  edges: OrderWorkflowGraph['edges'],
  nodeKey?: string | null,
): string[] {
  const byCode = edges.filter((e) => e.to === code).map((e) => e.from);
  if (byCode.length) return byCode;
  if (nodeKey && nodeKey !== code) {
    return edges.filter((e) => e.to === nodeKey).map((e) => e.from);
  }
  return [];
}

export function selectProductionFlowFromWorkflowGraph(
  graph: OrderWorkflowGraph,
  meta: {
    id: string;
    number: string;
    title: string | null;
    status: string;
    progressPercent: number;
    estimatedDelivery: string | null;
    isCommittedDelivery: boolean;
    promiseState: string | null;
    source: 'sales-order' | 'production-order';
  },
  role: ProductionFlowRole,
  locale = 'en',
): ProductionFlowModel {
  let stages: ProductionFlowStage[] = graph.stages.map((stage, index) => {
    const base: ProductionFlowStage = {
      code: stage.code,
      name: localizedName(
        asLocale(locale),
        { nameEn: stage.nameEn, nameAr: stage.nameAr, nameHe: stage.nameHe },
        stage.code,
      ),
      status: String(stage.status ?? 'PENDING'),
      progressPercent: Number(stage.progressPercent ?? 0),
      dependsOnCodes: dependsOnCodesForStage(stage.code, graph.edges, stage.nodeKey),
      sortOrder: index,
      snapshotNodeId: stage.id,
      stageDefinitionId: stage.stageDefinitionId ?? null,
      estimatedMinutes: stage.estimatedMinutes ?? null,
      estimateReviewRequired: Boolean(stage.estimateReviewRequired) || !(stage.estimatedMinutes && stage.estimatedMinutes > 0),
      photos: [],
      assignees: [],
      actualStart: null,
      actualEnd: null,
      plannedEnd: null,
      isOverdue: false,
      blockers: [],
      notes: null,
      attachmentCount: 0,
    };

    if (role !== 'admin') {
      return enforceDealerStageStrip(base);
    }

    return {
      ...base,
      assignees: stage.assignedEmployee
        ? [
            {
              id: stage.assignedEmployee.id,
              name: stage.assignedEmployee.name,
            },
          ]
        : [],
      blockers: (stage.blockers ?? []).map((b) => ({
        id: b.id,
        category: b.category,
        reason: b.reason,
      })),
      actualStart: stage.actualStart ?? null,
      actualEnd: stage.actualEnd ?? null,
      plannedEnd: stage.plannedEnd ?? null,
      notes: stage.notes ?? null,
    };
  });

  if (role === 'dealer') {
    stages = stages.map(enforceDealerStageStrip);
  }

  return {
    id: meta.id,
    number: meta.number,
    title: meta.title,
    status: meta.status,
    progressPercent: Number(graph.progressPercent ?? meta.progressPercent ?? 0),
    estimatedDelivery: meta.estimatedDelivery,
    isCommittedDelivery: meta.isCommittedDelivery,
    promiseState: meta.promiseState,
    stages,
    role,
    source: meta.source,
  };
}

export function pickProductionOrderIdFromSalesOrder(order: {
  productionOrders?: Array<{ id: string; progressPercent?: number | null }>;
}): string | null {
  const pos = order.productionOrders ?? [];
  if (!pos.length) return null;
  const best = pos.reduce((a, b) =>
    Number(b.progressPercent ?? 0) > Number(a.progressPercent ?? 0) ? b : a,
  );
  return best.id;
}
