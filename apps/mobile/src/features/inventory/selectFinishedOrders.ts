import type { FinishedLot } from '@/api/modules/inventory';
import { matchesFgFilter, type FgFilter, fgLeaveUrgency } from './fgFilters';

export type FinishedBoardScope = 'inWarehouse' | 'history';

export type FinishedOrderGroup = {
  salesOrderId: string;
  salesOrderNumber: string;
  projectName: string | null;
  dealerNameEn: string | null;
  dealerNameAr: string | null;
  dealerNameHe: string | null;
  productNameEn: string;
  productNameAr: string;
  productNameHe: string | null;
  productImageUrl: string | null;
  productionOrderIds: string[];
  productionOrderNumbers: string[];
  lots: FinishedLot[];
  unitsOnHand: number;
  packageCount: number;
  packagesPerUnit: number;
  pieceLabels: Array<{ nameEn: string; nameAr: string; nameHe?: string | null }>;
  packageSummary: string | null;
  warehouseIds: string[];
  warehouseLabels: string[];
  multiWarehouse: boolean;
  daysWaiting: number;
  deliveryId: string | null;
  deliveryStatus: string | null;
  deliveryNumber: string | null;
  deliveryDate: string | null;
  loadChecked: number;
  loadTotal: number;
  enteredAt: string | null;
  leftAt: string | null;
  /** Operational leave rank for sort (lower = sooner / more urgent). */
  leaveSortKey: number;
};

function productNames(lot: FinishedLot) {
  const item = lot.inventoryItem;
  const product = item.product;
  return {
    productNameEn: product?.nameEn || item.nameEn,
    productNameAr: product?.nameAr || item.nameAr,
    productNameHe: product?.nameHe || item.nameHe || null,
    productImageUrl: product?.imageUrl ?? null,
  };
}

function leaveSortKey(lot: FinishedLot, now = Date.now()): number {
  const urgency = fgLeaveUrgency(lot, now);
  if (urgency === 'overdue') return 0;
  if (urgency === 'leavingToday') return 1;
  if (urgency === 'pickupPlanned') {
    const t = lot.deliveryDate ? new Date(lot.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
    return 2 + t / 1e15;
  }
  return 3;
}

/**
 * Group finished lots by sales order for the outbound warehouse desk.
 * Lots without SO are grouped under a synthetic key.
 */
export function selectFinishedOrders(
  lots: FinishedLot[],
  opts: { fgFilter?: FgFilter; scope?: FinishedBoardScope } = {},
): FinishedOrderGroup[] {
  const filter = opts.fgFilter ?? 'all';
  const scope = opts.scope ?? 'inWarehouse';
  const filtered =
    scope === 'inWarehouse' ? lots.filter((lot) => matchesFgFilter(lot, filter)) : lots;

  const bySo = new Map<string, FinishedLot[]>();
  for (const lot of filtered) {
    const key = lot.salesOrder?.id || lot.salesOrderNumber || `lot:${lot.id}`;
    const list = bySo.get(key) ?? [];
    list.push(lot);
    bySo.set(key, list);
  }

  const groups: FinishedOrderGroup[] = [];
  for (const [key, groupLots] of bySo) {
    const primary = groupLots[0]!;
    const names = productNames(primary);
    const warehouseMap = new Map<string, string>();
    const poIds = new Set<string>();
    const poNumbers = new Set<string>();
    let units = 0;
    let packageCount = 0;
    let daysWaiting = 0;
    let loadChecked = 0;
    let loadTotal = 0;
    let packagesPerUnit = 1;
    let pieceLabels = primary.pieceLabels ?? [];
    let packageSummary = primary.packageSummary ?? null;
    let enteredAt: string | null = primary.enteredAt ?? primary.producedAt ?? null;
    let leftAt: string | null = primary.leftAt ?? null;

    for (const lot of groupLots) {
      units += Number(lot.quantity) || 0;
      const per = Math.max(1, Number(lot.packagesPerUnit) || 1);
      packagesPerUnit = Math.max(packagesPerUnit, per);
      packageCount += Number(lot.packageCount) || per * (Number(lot.quantity) || 1);
      daysWaiting = Math.max(daysWaiting, Number(lot.daysWaiting) || 0);
      loadChecked = Math.max(loadChecked, Number(lot.loadChecked) || 0);
      loadTotal = Math.max(loadTotal, Number(lot.loadTotal) || 0);
      if (lot.pieceLabels?.length) {
        pieceLabels = lot.pieceLabels;
        packageSummary = lot.packageSummary ?? packageSummary;
      }
      if (lot.warehouse?.id) {
        warehouseMap.set(
          lot.warehouse.id,
          lot.warehouse.nameEn || lot.warehouse.code || lot.warehouse.id,
        );
      }
      if (lot.productionOrder?.id) poIds.add(lot.productionOrder.id);
      const poNum = lot.productionOrder?.number || lot.productionOrderNumber;
      if (poNum) poNumbers.add(poNum);
      const ent = lot.enteredAt ?? lot.producedAt;
      if (ent && (!enteredAt || ent < enteredAt)) enteredAt = ent;
      if (lot.leftAt && (!leftAt || lot.leftAt > leftAt)) leftAt = lot.leftAt;
    }

    const warehouseLabels = [...warehouseMap.values()];
    groups.push({
      salesOrderId: primary.salesOrder?.id || key,
      salesOrderNumber:
        primary.salesOrderNumber || primary.salesOrder?.number || '—',
      projectName: primary.projectName ?? primary.salesOrder?.projectName ?? null,
      dealerNameEn: primary.dealerNameEn ?? null,
      dealerNameAr: primary.dealerNameAr ?? null,
      dealerNameHe: primary.dealerNameHe ?? null,
      ...names,
      productionOrderIds: [...poIds],
      productionOrderNumbers: [...poNumbers],
      lots: groupLots,
      unitsOnHand: units,
      packageCount,
      packagesPerUnit,
      pieceLabels,
      packageSummary:
        packageSummary ||
        (pieceLabels.length
          ? pieceLabels.map((p) => `${p.nameEn || p.nameAr} ×1`).join(' · ')
          : null),
      warehouseIds: [...warehouseMap.keys()],
      warehouseLabels,
      multiWarehouse: warehouseMap.size > 1,
      daysWaiting,
      deliveryId: primary.deliveryId ?? null,
      deliveryStatus: primary.deliveryStatus ?? null,
      deliveryNumber: primary.deliveryNumber ?? null,
      deliveryDate: primary.deliveryDate ?? null,
      loadChecked,
      loadTotal,
      enteredAt,
      leftAt,
      leaveSortKey: leaveSortKey(primary),
    });
  }

  groups.sort((a, b) => {
    if (a.leaveSortKey !== b.leaveSortKey) return a.leaveSortKey - b.leaveSortKey;
    return b.daysWaiting - a.daysWaiting;
  });
  return groups;
}
