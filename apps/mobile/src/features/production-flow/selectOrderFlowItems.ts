import { localizedName } from '@maher/i18n';
import type { SalesOrderDetail, SalesOrderStage } from '@/api/modules/sales-orders';

export type OrderFlowItem = {
  productionOrderId: string;
  salesOrderLineId: string | null;
  number: string;
  status: string;
  variantLabel: string;
  quantity: number | null;
  workflowName: string | null;
  progressPercent: number;
  progressLabel: string | null;
  currentStageName: string | null;
};

const DONE = new Set(['COMPLETED', 'SKIPPED', 'DONE']);

function asQty(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stageName(stage: SalesOrderStage, locale: string): string {
  return localizedName(
    locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en',
    { nameEn: stage.nameEn, nameAr: stage.nameAr, nameHe: stage.nameHe },
    stage.code,
  );
}

function currentStageName(
  po: NonNullable<SalesOrderDetail['productionOrders']>[number],
  locale: string,
): string | null {
  const stages = po.stages ?? [];
  const byCode =
    po.currentStageCode && stages.length
      ? stages.find((s) => s.code === po.currentStageCode)
      : undefined;
  const inProgress = stages.find((s) => String(s.status ?? '').toUpperCase() === 'IN_PROGRESS');
  const ready = stages.find((s) => String(s.status ?? '').toUpperCase() === 'READY');
  const incomplete = stages.filter((s) => !DONE.has(String(s.status ?? '').toUpperCase()));
  const progressed = [...incomplete]
    .filter((s) => Number(s.progressPercent ?? 0) > 0)
    .sort((a, b) => Number(b.progressPercent ?? 0) - Number(a.progressPercent ?? 0))[0];
  const pick = inProgress ?? ready ?? progressed ?? byCode ?? incomplete[0] ?? null;
  return pick ? stageName(pick, locale) : null;
}

export function selectOrderFlowItems(
  order: SalesOrderDetail | null | undefined,
  locale = 'en',
): OrderFlowItem[] {
  if (!order) return [];
  const lines = order.lines ?? [];
  const lineById = new Map(lines.map((l) => [l.id, l]));

  return (order.productionOrders ?? []).map((po) => {
    const line = po.salesOrderLineId ? lineById.get(po.salesOrderLineId) : undefined;
    const variantLabel =
      po.variantLabel?.trim() ||
      line?.variantLabel?.trim() ||
      line?.description?.trim() ||
      po.number;
    const workflowName = po.workflow
      ? localizedName(
          locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en',
          {
            nameEn: po.workflow.nameEn,
            nameAr: po.workflow.nameAr,
            nameHe: po.workflow.nameHe,
          },
          po.workflow.code ?? '',
        )
      : null;

    return {
      productionOrderId: po.id,
      salesOrderLineId: po.salesOrderLineId ?? null,
      number: po.number,
      status: po.status,
      variantLabel,
      quantity: asQty(po.quantity) ?? asQty(line?.quantity),
      workflowName: workflowName?.trim() || null,
      progressPercent: Number(po.progressPercent ?? 0),
      progressLabel: po.progressLabel?.trim() || null,
      currentStageName: currentStageName(po, locale),
    };
  });
}

export function shouldSkipOrderFlowList(items: OrderFlowItem[]): boolean {
  return items.length === 1;
}
