export type LowStockReason = 'LOW_STOCK' | 'PRODUCTION' | 'BOTH';

export type LowStockDraftItem = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  unit: string;
  imageUrl?: string | null;
  category?: string | null;
  minStock: number;
  reorderQty?: number | null;
  onHandQty: number;
  standardCost: number;
  lastUnitCost?: number | null;
  preferredSupplierId?: string | null;
  preferredSupplier?: {
    id: string;
    name: string;
    nameEn?: string | null;
    nameAr?: string | null;
    whatsappPhone?: string | null;
    phone?: string | null;
    isCertified?: boolean;
  } | null;
  defaultWarehouseId?: string | null;
  isPurchasable?: boolean;
  coveredByOpenOrder?: boolean;
  onOrderQty?: number;
  stillNeeded?: number;
  reason?: LowStockReason;
};

export type LowStockDraftRow = LowStockDraftItem & {
  suggestedQty: number;
};

export type LowStockDraftGroup = {
  supplierId: string | null;
  supplier: LowStockDraftItem['preferredSupplier'];
  items: LowStockDraftRow[];
};

export function suggestedReorderQty(item: {
  reorderQty?: number | null;
  minStock: number;
  onHandQty: number;
  stillNeeded?: number | null;
}): number {
  const stillNeeded = Number(item.stillNeeded ?? 0);
  const reorder = item.reorderQty != null ? Number(item.reorderQty) : null;
  if (reorder != null && Number.isFinite(reorder) && reorder > 0) {
    return Math.max(reorder, stillNeeded > 0 ? stillNeeded : 0);
  }
  const fallback = Math.max(Number(item.minStock) * 2 - Number(item.onHandQty), 1);
  return Math.max(fallback, stillNeeded > 0 ? stillNeeded : 0);
}

export function isLowStockItem(item: { onHandQty: number; minStock: number }): boolean {
  return Number(item.onHandQty) <= Number(item.minStock);
}

export function lowStockReason(item: {
  onHandQty: number;
  minStock: number;
  stillNeeded?: number | null;
  reason?: LowStockReason;
}): LowStockReason | null {
  if (item.reason) return item.reason;
  const low = isLowStockItem(item);
  const production = Number(item.stillNeeded ?? 0) > 0;
  if (low && production) return 'BOTH';
  if (low) return 'LOW_STOCK';
  if (production) return 'PRODUCTION';
  return null;
}

export function shouldIncludeDraftItem(item: LowStockDraftItem): boolean {
  if (item.isPurchasable === false) return false;
  return lowStockReason(item) != null;
}

export function groupLowStockDraft(items: LowStockDraftItem[]): {
  groups: LowStockDraftGroup[];
  unassigned: LowStockDraftGroup;
} {
  const bySupplier = new Map<string, LowStockDraftGroup>();
  const unassigned: LowStockDraftGroup = { supplierId: null, supplier: null, items: [] };

  for (const item of items) {
    if (!shouldIncludeDraftItem(item)) continue;
    const reason = lowStockReason(item) ?? 'LOW_STOCK';
    const row: LowStockDraftRow = {
      ...item,
      reason,
      onOrderQty: Number(item.onOrderQty ?? 0),
      suggestedQty: suggestedReorderQty({ ...item, stillNeeded: item.stillNeeded }),
    };
    const supplierId = item.preferredSupplierId ?? item.preferredSupplier?.id ?? null;
    if (!supplierId) {
      unassigned.items.push(row);
      continue;
    }
    const existing = bySupplier.get(supplierId);
    if (existing) {
      existing.items.push(row);
      continue;
    }
    bySupplier.set(supplierId, {
      supplierId,
      supplier: item.preferredSupplier ?? { id: supplierId, name: '' },
      items: [row],
    });
  }

  return {
    groups: [...bySupplier.values()],
    unassigned,
  };
}

export function countBuyAlert(items: LowStockDraftRow[]): {
  count: number;
  lowStockCount: number;
  productionCount: number;
} {
  let lowStockCount = 0;
  let productionCount = 0;
  for (const item of items) {
    if (item.reason === 'LOW_STOCK' || item.reason === 'BOTH') lowStockCount += 1;
    if (item.reason === 'PRODUCTION' || item.reason === 'BOTH') productionCount += 1;
  }
  return { count: items.length, lowStockCount, productionCount };
}
