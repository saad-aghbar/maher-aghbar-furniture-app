import { localizedName } from '@maher/i18n';
import { lineVisualIdentity } from '@maher/types';
import type { OrderProductionSetupLine } from './api';
import { complexityBadgeKey, type OrderManufacturingKind } from './orderManufacturingKind';

export type PlanItemSectionKey = 'spec' | 'materials' | 'workflow';

export type PlanItemSectionModel = {
  key: PlanItemSectionKey;
  done: boolean;
  alert: boolean;
};

export type PlanItemFloorModel = {
  id: string;
  salesOrderLineId: string;
  title: string;
  sku: string | null;
  quantity: number;
  imageUrl: string | null;
  complexity: OrderManufacturingKind;
  needsWorkflow: boolean;
  attention: boolean;
  fabricLabel: string | null;
  sections: PlanItemSectionModel[];
};

export type PlanItemsFloorModel = {
  orderNumber: string | null;
  dealerName: string | null;
  itemCount: number;
  readyCount: number;
  progressPercent: number;
  items: PlanItemFloorModel[];
};

export type PlanItemLineSource = Pick<
  OrderProductionSetupLine,
  | 'id'
  | 'salesOrderLineId'
  | 'manufacturingName'
  | 'description'
  | 'manufacturingComplexity'
  | 'quantity'
  | 'workflowId'
> & {
  imageUrl?: string | null;
  product?: OrderProductionSetupLine['product'];
  requestedFabricLabel?: string | null;
  fabric?: OrderProductionSetupLine['fabric'];
  sectionProgress?: {
    spec?: boolean;
    materials?: boolean;
    workflow?: boolean;
  } | null;
  issues?: Array<{ code?: string } | string> | null;
};

export type PlanItemsFloorInput = {
  orderNumber?: string | null;
  dealer?: {
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
  progress?: {
    readyLines?: number;
    totalLines?: number;
    percent?: number;
  } | null;
  lines: PlanItemLineSource[];
  locale: string;
};

function itemTitle(line: PlanItemLineSource, locale: string): string {
  if (line.manufacturingName?.trim()) return line.manufacturingName.trim();
  if (line.product) {
    return localizedName(locale, line.product, line.description ?? line.product.sku);
  }
  return line.description?.trim() || '—';
}

function fabricLabel(line: PlanItemLineSource): string | null {
  const selected = line.fabric?.selected?.displayName?.trim();
  if (selected) return selected;
  const requested =
    line.fabric?.requestedLabel?.trim() || line.requestedFabricLabel?.trim() || null;
  return requested || null;
}

function dealerName(
  dealer: PlanItemsFloorInput['dealer'],
  locale: string,
): string | null {
  if (!dealer) return null;
  const name = localizedName(locale, dealer, dealer.code ?? '');
  const trimmed = name.trim();
  if (!trimmed || trimmed === '—') return null;
  return trimmed;
}

export function selectPlanItemFloor(
  line: PlanItemLineSource,
  locale: string,
): PlanItemFloorModel {
  const complexity = complexityBadgeKey(line.manufacturingComplexity);
  const needsWorkflow = complexity === 'custom' && !line.workflowId;
  const specDone = Boolean(line.sectionProgress?.spec);
  const materialsDone = Boolean(line.sectionProgress?.materials);
  const workflowDone = Boolean(line.workflowId) || Boolean(line.sectionProgress?.workflow);
  const issueCount = line.issues?.length ?? 0;

  return {
    id: line.id,
    salesOrderLineId: line.salesOrderLineId,
    title: itemTitle(line, locale),
    sku: line.product?.sku?.trim() || null,
    quantity: line.quantity,
    imageUrl: lineVisualIdentity({
      productImageRef: line.imageUrl,
      productImageUrl: line.product?.imageUrl,
    }),
    complexity,
    needsWorkflow,
    attention: needsWorkflow || issueCount > 0,
    fabricLabel: fabricLabel(line),
    sections: [
      { key: 'spec', done: specDone, alert: false },
      { key: 'materials', done: materialsDone, alert: false },
      { key: 'workflow', done: workflowDone && !needsWorkflow, alert: needsWorkflow },
    ],
  };
}

export function planItemIsReady(item: PlanItemFloorModel): boolean {
  const spec = item.sections.find((row) => row.key === 'spec')?.done;
  const materials = item.sections.find((row) => row.key === 'materials')?.done;
  const workflow = item.sections.find((row) => row.key === 'workflow')?.done;
  if (!spec || !materials) return false;
  if (item.complexity === 'custom') return Boolean(workflow);
  return true;
}

export function selectPlanItemsFloor(input: PlanItemsFloorInput): PlanItemsFloorModel {
  const items = input.lines.map((line) => selectPlanItemFloor(line, input.locale));
  const computedReady = items.filter(planItemIsReady).length;
  const readyCount = input.progress?.readyLines ?? computedReady;
  const itemCount = input.progress?.totalLines ?? items.length;
  const progressPercent =
    input.progress?.percent != null
      ? Math.max(0, Math.min(100, Math.round(input.progress.percent)))
      : itemCount
        ? Math.round((100 * readyCount) / itemCount)
        : 0;

  return {
    orderNumber: input.orderNumber?.trim() || null,
    dealerName: dealerName(input.dealer, input.locale),
    itemCount,
    readyCount,
    progressPercent,
    items,
  };
}
