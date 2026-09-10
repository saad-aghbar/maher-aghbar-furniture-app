import type { LowStockDraftItem, LowStockDraftResponse } from '@/api/modules/purchasing';
import { locationPickerLabel, pickDefaultLocationId, warehouseBinLine } from '@/features/inventory/pickDefaultLocation';
import { toggleIdInSet } from './purchasingToggle';
import { isFabricCategory } from './orderBuilder';

export type LowStockReviewRow = {
  itemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  unit: string;
  category?: string | null;
  imageUrl?: string | null;
  onHandQty: number;
  minStock: number;
  suggestedQty: number;
  orderQty: string;
  warehouseId: string;
  locationId: string;
  warehouseName?: string;
  locationName?: string;
  supplierId: string | null;
  lastUnitCost: number;
  isFabric: boolean;
  coveredByOpenOrder: boolean;
  onOrderQty: number;
  stillNeeded?: number;
  reason?: 'LOW_STOCK' | 'PRODUCTION' | 'BOTH';
};

export function seedLowStockRows(draft: LowStockDraftResponse): LowStockReviewRow[] {
  const groups = [...(draft.groups ?? []), draft.unassigned].filter(Boolean);
  const rows: LowStockReviewRow[] = [];
  for (const group of groups) {
    for (const item of group.items ?? []) {
      rows.push(rowFromDraftItem(item, group.supplierId ?? item.preferredSupplierId ?? null));
    }
  }
  return rows;
}

export function rowFromDraftItem(
  item: LowStockDraftItem,
  supplierId: string | null,
): LowStockReviewRow {
  return {
    itemId: item.id,
    sku: item.sku,
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    nameHe: item.nameHe,
    unit: item.unit,
    category: item.category ?? null,
    imageUrl: item.imageUrl ?? null,
    onHandQty: Number(item.onHandQty) || 0,
    minStock: Number(item.minStock) || 0,
    suggestedQty: Number(item.suggestedQty) || 1,
    orderQty: String(item.suggestedQty || 1),
    warehouseId: item.defaultWarehouseId ?? '',
    locationId: '',
    warehouseName: undefined,
    locationName: undefined,
    supplierId,
    lastUnitCost: Number(item.lastUnitCost ?? item.standardCost) || 0,
    isFabric: isFabricCategory(item.category),
    coveredByOpenOrder: Boolean(item.coveredByOpenOrder),
    onOrderQty: Number(item.onOrderQty) || 0,
    stillNeeded: item.stillNeeded,
    reason: item.reason,
  };
}

export function seedLowStockExcluded(rows: LowStockReviewRow[]): Set<string> {
  return new Set(rows.filter((row) => row.coveredByOpenOrder).map((row) => row.itemId));
}

export function groupLowStockRows(rows: LowStockReviewRow[]) {
  const map = new Map<string, LowStockReviewRow[]>();
  for (const row of rows) {
    const key = row.supplierId ?? 'unassigned';
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()].map(([supplierId, items]) => ({
    supplierId: supplierId === 'unassigned' ? null : supplierId,
    items,
  }));
}

export function moveLowStockRow(
  rows: LowStockReviewRow[],
  itemId: string,
  supplierId: string | null,
): LowStockReviewRow[] {
  return rows.map((row) => (row.itemId === itemId ? { ...row, supplierId } : row));
}

export function updateLowStockQty(
  rows: LowStockReviewRow[],
  itemId: string,
  orderQty: string,
): LowStockReviewRow[] {
  return rows.map((row) => (row.itemId === itemId ? { ...row, orderQty } : row));
}

export function updateLowStockDest(
  rows: LowStockReviewRow[],
  itemId: string,
  patch: Partial<Pick<LowStockReviewRow, 'warehouseId' | 'locationId' | 'warehouseName' | 'locationName'>>,
): LowStockReviewRow[] {
  return rows.map((row) => (row.itemId === itemId ? { ...row, ...patch } : row));
}

export type LowStockWarehouseRef = {
  id: string;
  code?: string | null;
  name?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  locations?: Array<{
    id: string;
    name?: string | null;
    code?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  }>;
};

function warehouseDisplayName(warehouse: LowStockWarehouseRef | undefined, locale: string): string {
  if (!warehouse) return '';
  return locale === 'ar'
    ? warehouse.nameAr || warehouse.nameEn || warehouse.name || warehouse.code || ''
    : warehouse.nameEn || warehouse.nameAr || warehouse.name || warehouse.code || '';
}

export function applyLowStockDestinationNames(
  rows: LowStockReviewRow[],
  warehouses: LowStockWarehouseRef[],
  locale: string,
): LowStockReviewRow[] {
  let changed = false;
  const next = rows.map((row) => {
    const byId = warehouses.find((w) => w.id === row.warehouseId);
    const byLoc = warehouses.find((w) => (w.locations ?? []).some((l) => l.id === row.locationId));
    const warehouse = byId ?? byLoc;
    const locationId =
      row.locationId ||
      (row.warehouseId ? pickDefaultLocationId(warehouse?.locations ?? []) : '');
    const location = (warehouse?.locations ?? []).find((l) => l.id === locationId);
    const warehouseName = warehouseDisplayName(warehouse, locale) || row.warehouseName;
    const locationName = location
      ? locationPickerLabel(location) || row.locationName
      : row.locationName;
    if (
      warehouseName === row.warehouseName &&
      locationName === row.locationName &&
      locationId === row.locationId
    ) {
      return row;
    }
    changed = true;
    return { ...row, warehouseName, locationName, locationId };
  });
  return changed ? next : rows;
}

export function lowStockDestinationLabel(row: LowStockReviewRow): string {
  return warehouseBinLine(row.warehouseName ?? '', row.locationName);
}

export function toggleLowStockExcluded(excluded: Set<string>, itemId: string): Set<string> {
  return toggleIdInSet(excluded, itemId);
}

export function includedLowStockRows(
  rows: LowStockReviewRow[],
  excluded: Set<string>,
): LowStockReviewRow[] {
  return rows.filter((row) => !excluded.has(row.itemId) && Number(row.orderQty) > 0);
}

export function lowStockConfirmBlocked(
  rows: LowStockReviewRow[],
  excluded: Set<string>,
): 'unassigned' | 'empty' | 'holding' | null {
  const included = includedLowStockRows(rows, excluded);
  if (included.length === 0) return 'empty';
  if (included.some((row) => !row.supplierId)) return 'unassigned';
  if (included.some((row) => !row.locationId)) return 'holding';
  return null;
}

export function buildLowStockBatchPayload(
  rows: LowStockReviewRow[],
  excluded: Set<string>,
): { supplierId: string; origin: 'LOW_STOCK'; warehouseId?: string; lines: Array<{
  description: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId: string;
  unit: string;
  warehouseId?: string;
  locationId?: string;
}> }[] {
  const included = includedLowStockRows(rows, excluded).filter((row) => row.supplierId);
  const bySupplier = new Map<string, LowStockReviewRow[]>();
  for (const row of included) {
    const list = bySupplier.get(row.supplierId!) ?? [];
    list.push(row);
    bySupplier.set(row.supplierId!, list);
  }
  return [...bySupplier.entries()].map(([supplierId, items]) => ({
    supplierId,
    origin: 'LOW_STOCK' as const,
    warehouseId: items[0]?.warehouseId || undefined,
    lines: items.map((row) => ({
      description: row.nameEn || row.nameAr || row.sku,
      quantity: Number(row.orderQty),
      unitPrice: row.lastUnitCost,
      inventoryItemId: row.itemId,
      unit: row.unit,
      warehouseId: row.warehouseId || undefined,
      locationId: row.locationId || undefined,
    })),
  }));
}

export function lowStockRunSummary(rows: LowStockReviewRow[], excluded: Set<string>) {
  const included = includedLowStockRows(rows, excluded);
  const suppliers = new Set(included.map((row) => row.supplierId).filter(Boolean));
  const estimated = included.reduce(
    (sum, row) => sum + Number(row.orderQty) * row.lastUnitCost,
    0,
  );
  return {
    supplierCount: suppliers.size,
    itemCount: included.length,
    estimated,
  };
}
