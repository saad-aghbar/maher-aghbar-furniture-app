export type LowStockItem = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  suggestedQty: number;
  preferredSupplierId?: string | null;
  defaultWarehouseId?: string | null;
  lastUnitCost?: number | null;
  standardCost?: number;
  unit?: string;
  category?: string | null;
  coveredByOpenOrder?: boolean;
  onOrderQty?: number;
  stillNeeded?: number;
  reason?: 'LOW_STOCK' | 'PRODUCTION' | 'BOTH';
};

export type LowStockRow = {
  itemId: string;
  sku?: string;
  supplierId: string | null;
  orderQty: string;
  warehouseId: string;
  locationId?: string;
  unitPrice: number;
  description: string;
  unit: string;
  category?: string | null;
  coveredByOpenOrder?: boolean;
  onOrderQty?: number;
};

export function seedLowStockRows(
  groups: Array<{ supplierId: string | null; items: LowStockItem[] }>,
): LowStockRow[] {
  return groups.flatMap((group) =>
    (group.items ?? []).map((item) => ({
      itemId: item.id,
      sku: item.sku,
      supplierId: group.supplierId ?? item.preferredSupplierId ?? null,
      orderQty: String(item.suggestedQty || 1),
      warehouseId: item.defaultWarehouseId ?? '',
      locationId: '',
      unitPrice: Number(item.lastUnitCost ?? item.standardCost) || 0,
      description: item.nameEn || item.sku,
      unit: item.unit || 'pcs',
      category: item.category,
      coveredByOpenOrder: Boolean(item.coveredByOpenOrder),
      onOrderQty: Number(item.onOrderQty) || 0,
    })),
  );
}

export function seedExcludedCovered(rows: LowStockRow[]): Set<string> {
  return new Set(rows.filter((row) => row.coveredByOpenOrder).map((row) => row.itemId));
}

export function moveLowStockRow(
  rows: LowStockRow[],
  itemId: string,
  supplierId: string | null,
): LowStockRow[] {
  return rows.map((row) => (row.itemId === itemId ? { ...row, supplierId } : row));
}

export function buildLowStockBatch(
  rows: LowStockRow[],
  excluded: Set<string>,
) {
  const included = rows.filter((row) => !excluded.has(row.itemId) && row.supplierId && Number(row.orderQty) > 0);
  const bySupplier = new Map<string, LowStockRow[]>();
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
      description: row.description,
      quantity: Number(row.orderQty),
      unitPrice: row.unitPrice,
      inventoryItemId: row.itemId,
      unit: row.unit,
      warehouseId: row.warehouseId || undefined,
      locationId: row.locationId || undefined,
    })),
  }));
}

export function renderWhatsAppTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  if (!template.trim()) return vars.lines ?? '';
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_all, key: string) => vars[key] ?? '');
}
