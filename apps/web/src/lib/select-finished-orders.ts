/** Admin parity with mobile `selectFinishedOrders` + `fgFilters`. */

export type FgFilter =
  | 'all'
  | 'waitingForTruck'
  | 'pickupPlanned'
  | 'leavingToday'
  | 'overdue';

export const FG_FILTERS: FgFilter[] = [
  'all',
  'waitingForTruck',
  'pickupPlanned',
  'leavingToday',
  'overdue',
];

export type FinishedBoardScope = 'inWarehouse' | 'history';

export type AdminFinishedLot = {
  id: string;
  quantity: string | number;
  producedAt: string;
  status: string;
  inventoryItem: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    product?: {
      nameEn?: string;
      nameAr?: string;
      nameHe?: string | null;
      imageUrl?: string | null;
      sku?: string | null;
    } | null;
  };
  warehouse: {
    id: string;
    code: string;
    nameEn: string;
    nameAr?: string;
    nameHe?: string | null;
  };
  productionOrder?: { id: string; number: string } | null;
  salesOrder?: {
    id: string;
    number?: string;
    projectName?: string | null;
    deliveries?: Array<{ id: string; number?: string; status?: string }>;
  } | null;
  daysWaiting?: number;
  salesOrderNumber?: string | null;
  projectName?: string | null;
  dealerNameEn?: string | null;
  dealerNameAr?: string | null;
  dealerNameHe?: string | null;
  productNameEn?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  productionOrderNumber?: string | null;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  deliveryNumber?: string | null;
  deliveryDate?: string | null;
  packagesPerUnit?: number;
  packageCount?: number;
  pieceLabels?: Array<{ nameEn: string; nameAr: string; nameHe?: string | null }>;
  packageSummary?: string | null;
  loadChecked?: number;
  loadTotal?: number;
  enteredAt?: string | null;
  leftAt?: string | null;
};

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
  lots: AdminFinishedLot[];
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
  leaveSortKey: number;
};

export type FgLeaveUrgency =
  | 'overdue'
  | 'leavingToday'
  | 'pickupPlanned'
  | 'waitingForTruck';

export function fgTodayYmd(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Shipped / delivered lots must not appear as physically in Finished Goods. */
export function isFgLotPhysicallyPresent(
  lot: Pick<AdminFinishedLot, 'deliveryStatus'>,
): boolean {
  const s = lot.deliveryStatus?.toUpperCase() ?? null;
  return s !== 'OUT_FOR_DELIVERY' && s !== 'DELIVERED';
}

export function matchesFgFilter(
  lot: Pick<AdminFinishedLot, 'deliveryStatus' | 'deliveryDate'>,
  filter: FgFilter,
  today = fgTodayYmd(),
): boolean {
  if (!isFgLotPhysicallyPresent(lot)) return false;

  switch (filter) {
    case 'all':
      return true;
    case 'waitingForTruck':
      return !lot.deliveryStatus;
    case 'pickupPlanned':
      return lot.deliveryStatus === 'PLANNED' || lot.deliveryStatus === 'READY';
    case 'leavingToday':
      return Boolean(lot.deliveryDate && lot.deliveryDate.slice(0, 10) === today);
    case 'overdue': {
      const planned = lot.deliveryDate?.slice(0, 10);
      if (!planned || planned >= today) return false;
      const s = lot.deliveryStatus?.toUpperCase();
      return !s || s === 'PLANNED' || s === 'READY';
    }
  }
}

export function fgLeaveUrgency(
  lot: Pick<AdminFinishedLot, 'deliveryStatus' | 'deliveryDate'>,
  now = Date.now(),
): FgLeaveUrgency {
  const today = fgTodayYmd(now);
  const planned = lot.deliveryDate?.slice(0, 10);
  const s = lot.deliveryStatus?.toUpperCase() ?? null;

  if (planned && planned < today && (!s || s === 'PLANNED' || s === 'READY')) {
    return 'overdue';
  }
  if (planned && planned === today) return 'leavingToday';
  if (s === 'PLANNED' || s === 'READY' || planned) return 'pickupPlanned';
  return 'waitingForTruck';
}

export function fgLeaveByLabelKey(
  lot: Pick<AdminFinishedLot, 'deliveryStatus' | 'deliveryDate'>,
  now = Date.now(),
): { key: string; values?: Record<string, string | number> } {
  const urgency = fgLeaveUrgency(lot, now);
  if (urgency === 'waitingForTruck') return { key: 'waitingForTruck' };
  if (urgency === 'leavingToday') return { key: 'leavingToday' };
  if (urgency === 'pickupPlanned') return { key: 'pickupPlanned' };
  const planned = lot.deliveryDate?.slice(0, 10);
  if (!planned) return { key: 'overduePickup' };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const leave = new Date(`${planned}T00:00:00`);
  const days = Math.max(1, Math.round((today.getTime() - leave.getTime()) / 86_400_000));
  return { key: 'overdueByDays', values: { days } };
}

export function boardParamsForFinishedScope(
  scope: FinishedBoardScope,
  extras: { from?: string; to?: string; warehouseId?: string; q?: string } = {},
): {
  scope: FinishedBoardScope;
  from?: string;
  to?: string;
  warehouseId?: string;
  q?: string;
} {
  if (scope === 'history') {
    return {
      scope: 'history',
      from: extras.from,
      to: extras.to,
      warehouseId: extras.warehouseId,
      q: extras.q,
    };
  }
  return {
    scope: 'inWarehouse',
    warehouseId: extras.warehouseId,
    q: extras.q,
  };
}

function productNames(lot: AdminFinishedLot) {
  const item = lot.inventoryItem;
  const product = item.product;
  return {
    productNameEn: lot.productNameEn || product?.nameEn || item.nameEn,
    productNameAr: lot.productNameAr || product?.nameAr || item.nameAr,
    productNameHe: lot.productNameHe || product?.nameHe || item.nameHe || null,
    productImageUrl: product?.imageUrl ?? null,
  };
}

function leaveSortKey(lot: AdminFinishedLot, now = Date.now()): number {
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
  lots: AdminFinishedLot[],
  opts: { fgFilter?: FgFilter; scope?: FinishedBoardScope } = {},
): FinishedOrderGroup[] {
  const filter = opts.fgFilter ?? 'all';
  const scope = opts.scope ?? 'inWarehouse';
  const filtered =
    scope === 'inWarehouse' ? lots.filter((lot) => matchesFgFilter(lot, filter)) : lots;

  const bySo = new Map<string, AdminFinishedLot[]>();
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
      salesOrderNumber: primary.salesOrderNumber || primary.salesOrder?.number || '—',
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

export function fgFilterLabelKey(filter: FgFilter): string {
  switch (filter) {
    case 'all':
      return 'tabs.all';
    case 'waitingForTruck':
      return 'waitingForTruck';
    case 'pickupPlanned':
      return 'pickupPlanned';
    case 'leavingToday':
      return 'leavingToday';
    case 'overdue':
      return 'overduePickup';
  }
}
