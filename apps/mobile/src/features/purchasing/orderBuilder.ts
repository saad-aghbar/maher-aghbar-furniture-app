import type { InventoryCategoryGroup } from '@/api/modules/inventory';
import { toggleIdInRecord } from './purchasingToggle';

export type BuilderMaterial = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category?: string | null;
  imageUrl?: string | null;
  onHandQty?: number;
  minStock?: number;
  standardCost?: number;
  preferredSupplierId?: string | null;
  reorderQty?: number | null;
};

export type BuilderMaterialSource = {
  id: string;
  sku: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  unit?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  onHandQty?: number | string | null;
  minStock?: number | string | null;
  standardCost?: number | string | null;
  preferredSupplierId?: string | null;
  preferredSupplier?: { id?: string | null } | null;
  reorderQty?: number | string | null;
  balances?: Array<{ availableQty?: number | string | null }>;
};

function toQty(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseBuilderSeedIds(params: {
  itemId?: string | string[];
  itemIds?: string | string[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value?: string | string[]) => {
    if (value == null) return;
    const parts = Array.isArray(value) ? value : [value];
    for (const part of parts) {
      for (const id of String(part).split(',')) {
        const trimmed = id.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
  };
  push(params.itemIds);
  push(params.itemId);
  return out;
}

export function toBuilderMaterial(item: BuilderMaterialSource, locale: string): BuilderMaterial {
  const fromOnHand = Number(item.onHandQty);
  const onHandQty = Number.isFinite(fromOnHand)
    ? fromOnHand
    : (item.balances ?? []).reduce((sum, row) => sum + toQty(row.availableQty), 0);
  const reorderRaw = item.reorderQty;
  const reorderQty =
    reorderRaw != null && String(reorderRaw) !== '' && Number(reorderRaw) > 0
      ? Number(reorderRaw)
      : null;
  return {
    id: item.id,
    sku: item.sku,
    name:
      locale === 'ar'
        ? item.nameAr || item.nameEn || item.sku
        : locale === 'he'
          ? item.nameHe || item.nameEn || item.nameAr || item.sku
          : item.nameEn || item.nameAr || item.sku,
    unit: item.unit || 'pcs',
    category: item.category ?? null,
    imageUrl: item.imageUrl ?? null,
    onHandQty,
    minStock: toQty(item.minStock),
    standardCost: toQty(item.standardCost),
    preferredSupplierId: item.preferredSupplierId ?? item.preferredSupplier?.id ?? null,
    reorderQty,
  };
}

export function suggestedBuilderQty(material: {
  reorderQty?: number | null;
  minStock?: number;
  onHandQty?: number;
}): string {
  const reorder = Number(material.reorderQty);
  if (Number.isFinite(reorder) && reorder > 0) return String(reorder);
  return String(Math.max((Number(material.minStock) || 0) - (Number(material.onHandQty) || 0), 1));
}

export function seedBuilderLines(
  current: Record<string, BuilderLine>,
  materials: BuilderMaterial[],
  opts: {
    defaultWarehouseId: string;
    defaultWarehouseName?: string;
    supplierNameById: Record<string, string>;
  },
): Record<string, BuilderLine> {
  let next = current;
  let changed = false;
  for (const material of materials) {
    if (next[material.id]) continue;
    if (!changed) {
      next = { ...current };
      changed = true;
    }
    const supplierId = material.preferredSupplierId ?? '';
    next[material.id] = makeBuilderLine(material, {
      warehouseId: opts.defaultWarehouseId,
      warehouseName: opts.defaultWarehouseName,
      supplierId,
      supplierName: supplierId ? opts.supplierNameById[supplierId] ?? '' : '',
      quantity: suggestedBuilderQty(material),
    });
  }
  return next;
}

export type BuilderLine = {
  inventoryItemId: string;
  sku: string;
  description: string;
  unit: string;
  category?: string | null;
  imageUrl?: string | null;
  quantity: string;
  unitCost: string;
  warehouseId: string;
  warehouseName?: string;
  locationId: string;
  locationName?: string;
  supplierId: string;
  supplierName: string;
};

export function isFabricCategory(category?: string | null): boolean {
  return String(category ?? '').toUpperCase() === 'FABRIC';
}

export function categoryGroupForItem(category?: string | null): InventoryCategoryGroup {
  const value = String(category ?? '').toUpperCase();
  if (value === 'FABRIC') return 'fabric';
  if (value === 'FOAM') return 'foam';
  if (value === 'WOOD') return 'wood';
  return 'accessories';
}

export function makeBuilderLine(
  material: BuilderMaterial,
  defaults: {
    warehouseId?: string;
    warehouseName?: string;
    locationId?: string;
    locationName?: string;
    supplierId?: string;
    supplierName?: string;
    quantity?: string;
    unitCost?: string;
  } = {},
): BuilderLine {
  return {
    inventoryItemId: material.id,
    sku: material.sku,
    description: material.name,
    unit: material.unit || 'pcs',
    category: material.category ?? null,
    imageUrl: material.imageUrl ?? null,
    quantity: defaults.quantity ?? '1',
    unitCost: defaults.unitCost ?? String(material.standardCost ?? 0),
    warehouseId: defaults.warehouseId ?? '',
    warehouseName: defaults.warehouseName,
    locationId: defaults.locationId ?? '',
    locationName: defaults.locationName,
    supplierId: defaults.supplierId ?? material.preferredSupplierId ?? '',
    supplierName: defaults.supplierName ?? '',
  };
}

export function toggleBuilderMaterial(
  current: Record<string, BuilderLine>,
  material: BuilderMaterial,
  defaultWarehouseId: string,
): Record<string, BuilderLine> {
  return toggleIdInRecord(current, material.id, () =>
    makeBuilderLine(material, { warehouseId: defaultWarehouseId }),
  );
}

export function upsertBuilderLine(
  current: Record<string, BuilderLine>,
  line: BuilderLine,
): Record<string, BuilderLine> {
  return { ...current, [line.inventoryItemId]: line };
}

export function removeBuilderLine(
  current: Record<string, BuilderLine>,
  id: string,
): Record<string, BuilderLine> {
  const next = { ...current };
  delete next[id];
  return next;
}

export function updateBuilderLine(
  current: Record<string, BuilderLine>,
  id: string,
  patch: Partial<BuilderLine>,
): Record<string, BuilderLine> {
  const existing = current[id];
  if (!existing) return current;
  return { ...current, [id]: { ...existing, ...patch } };
}

export function builderLineTotal(line: BuilderLine): number {
  const qty = Number(line.quantity);
  const cost = Number(line.unitCost);
  if (!(qty > 0) || !Number.isFinite(cost) || cost < 0) return 0;
  return qty * cost;
}

export function builderTotals(lines: BuilderLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + builderLineTotal(line), 0);
  const tax = subtotal * 0.16;
  return { subtotal, tax, total: subtotal + tax };
}

export type BuilderValidationCode =
  | 'supplierRequired'
  | 'materialsRequired'
  | 'zeroQty'
  | 'holdingRequired'
  | 'warehouseRequired';

export function validateBuilderOrder(input: {
  supplierId?: string | null;
  lines: BuilderLine[];
}): BuilderValidationCode | null {
  const active = input.lines.filter((line) => Number(line.quantity) > 0);
  if (active.length === 0) return 'materialsRequired';
  if (input.lines.some((line) => !(Number(line.quantity) > 0))) return 'zeroQty';
  if (input.lines.some((line) => !line.supplierId && !input.supplierId)) return 'supplierRequired';
  if (input.lines.some((line) => isFabricCategory(line.category) && !line.locationId)) {
    return 'holdingRequired';
  }
  if (input.lines.some((line) => !isFabricCategory(line.category) && !line.warehouseId)) {
    return 'warehouseRequired';
  }
  return null;
}

export function groupBuilderLinesBySupplier(lines: BuilderLine[]) {
  const map = new Map<string, BuilderLine[]>();
  for (const line of lines) {
    const key = line.supplierId || 'unassigned';
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }
  return [...map.entries()].map(([supplierId, items]) => ({
    supplierId: supplierId === 'unassigned' ? '' : supplierId,
    supplierName: items[0]?.supplierName || '',
    lines: items,
    totals: builderTotals(items),
  }));
}

export function buildCreateOrderPayload(input: {
  supplierId: string;
  warehouseId?: string;
  notes?: string;
  expectedDeliveryDate?: string;
  origin?: string;
  lines: BuilderLine[];
}) {
  return {
    supplierId: input.supplierId,
    warehouseId: input.warehouseId || undefined,
    notes: input.notes?.trim() || undefined,
    expectedDeliveryDate: input.expectedDeliveryDate || undefined,
    origin: input.origin ?? 'MANUAL',
    lines: input.lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitCost) || 0,
      inventoryItemId: line.inventoryItemId,
      unit: line.unit,
      warehouseId: line.warehouseId || undefined,
      locationId: line.locationId || undefined,
    })),
  };
}

export function buildRunPayload(input: {
  notes?: string;
  expectedDeliveryDate?: string;
  origin?: string;
  lines: BuilderLine[];
}) {
  return {
    notes: input.notes?.trim() || undefined,
    expectedDeliveryDate: input.expectedDeliveryDate || undefined,
    origin: input.origin ?? 'MANUAL',
    orders: groupBuilderLinesBySupplier(input.lines)
      .filter((group) => group.supplierId)
      .map((group) =>
        buildCreateOrderPayload({
          supplierId: group.supplierId,
          warehouseId: group.lines[0]?.warehouseId,
          notes: input.notes,
          expectedDeliveryDate: input.expectedDeliveryDate,
          origin: input.origin,
          lines: group.lines,
        }),
      ),
  };
}

export function destinationLabel(line: {
  category?: string | null;
  warehouseName?: string;
  locationName?: string;
  warehouseId?: string;
  locationId?: string;
}): string {
  if (isFabricCategory(line.category)) {
    return line.locationName || line.locationId || '';
  }
  return line.warehouseName || line.warehouseId || '';
}
