import type { InventoryCategoryGroup, InventoryItem, InventoryTransaction } from './api';

function toNumber(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function localizedName(
  item: { nameEn: string; nameAr: string },
  locale: string,
): string {
  if (locale === 'ar') return item.nameAr || item.nameEn;
  return item.nameEn || item.nameAr;
}

const ACCESSORY_CATEGORIES = new Set([
  'METAL_ACCESSORY',
  'DECORATIVE_ACCESSORY',
  'PACKAGING',
]);

export function isAccessoryCategory(category: string): boolean {
  return ACCESSORY_CATEGORIES.has(category);
}

export type InventoryItemCardModel = {
  id: string;
  name: string;
  nameEn: string;
  nameAr: string;
  sku: string;
  category: string;
  itemClass?: string | null;
  materialType: string | null;
  barcode: string | null;
  color: string | null;
  size: string | null;
  customMeasurements: InventoryItem['customMeasurements'];
  imageUrl: string | null;
  isAccessory: boolean;
  minStock: number;
  standardCost: number | null;
  quantityLabel: string;
  onHand: number;
  reservedQty: number;
  freeQty: number;
  quarantinedQty: number;
  quarantined: boolean;
  unit: string;
  isLowStock: boolean;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK';
  showCost: boolean;
  costLabel: string | null;
  balances: Array<{
    warehouseId: string;
    warehouseName: string;
    availableQty: number;
    reservedQty: number;
    freeQty: number;
    quantityLabel: string;
  }>;
};

export type InventoryItemDetailModel = InventoryItemCardModel & {
  color: string | null;
  size: string | null;
  description: string | null;
  minStock: number;
};

export type InventoryTransactionRow = {
  id: string;
  type: string;
  quantityLabel: string;
  warehouseName: string;
  notes: string | null;
  createdAt: string;
  showCost: boolean;
  costLabel: string | null;
};

export function sumOnHand(item: InventoryItem): number {
  return (item.balances ?? []).reduce((s, b) => s + toNumber(b.availableQty), 0);
}

function warehouseLabel(
  b: NonNullable<InventoryItem['balances']>[number],
  locale: string,
): string {
  const wh =
    locale === 'ar'
      ? b.warehouse?.nameAr || b.warehouse?.nameEn || b.warehouse?.code
      : b.warehouse?.nameEn || b.warehouse?.nameAr || b.warehouse?.code;
  return wh || '—';
}

/** One row per warehouse — balances are unique on item + warehouse + location. */
function collapseBalancesByWarehouse(
  balances: NonNullable<InventoryItem['balances']>,
  locale: string,
  unit: string,
): InventoryItemCardModel['balances'] {
  const byWh = new Map<
    string,
    {
      warehouseId: string;
      warehouseName: string;
      availableQty: number;
      reservedQty: number;
    }
  >();
  for (const b of balances) {
    const qty = toNumber(b.availableQty);
    const reserved = toNumber(b.reservedQty);
    const existing = byWh.get(b.warehouseId);
    if (existing) {
      existing.availableQty += qty;
      existing.reservedQty += reserved;
      continue;
    }
    byWh.set(b.warehouseId, {
      warehouseId: b.warehouseId,
      warehouseName: warehouseLabel(b, locale),
      availableQty: qty,
      reservedQty: reserved,
    });
  }
  return [...byWh.values()].map((row) => ({
    ...row,
    freeQty: row.availableQty - row.reservedQty,
    quantityLabel: `${formatQty(row.availableQty)} ${unit}`,
  }));
}

export function selectInventoryItemCard(
  item: InventoryItem,
  locale: string,
): InventoryItemCardModel {
  const onHand = sumOnHand(item);
  const reservedQty = (item.balances ?? []).reduce(
    (s, b) => s + toNumber(b.reservedQty),
    0,
  );
  const quarantinedQty = toNumber(item.quarantinedQty);
  const minStock = toNumber(item.minStock);
  const isLowStock = onHand <= minStock;
  const hasCost =
    item.standardCost !== undefined &&
    item.standardCost !== null &&
    String(item.standardCost) !== '';

  return {
    id: item.id,
    name: localizedName(item, locale),
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    sku: item.sku,
    category: item.category,
    itemClass: item.itemClass ?? null,
    materialType: item.materialType ?? null,
    barcode: item.barcode ?? null,
    color: item.color ?? null,
    size: item.size ?? null,
    customMeasurements: item.customMeasurements ?? null,
    imageUrl: item.imageUrl?.trim() || null,
    isAccessory: isAccessoryCategory(item.category),
    minStock,
    standardCost: hasCost ? toNumber(item.standardCost) : null,
    onHand,
    reservedQty,
    freeQty: onHand - reservedQty,
    quarantinedQty,
    quarantined: quarantinedQty > 0,
    unit: item.unit || 'pcs',
    quantityLabel: `${formatQty(onHand)} ${item.unit || 'pcs'}`,
    isLowStock,
    stockStatus: isLowStock ? 'LOW_STOCK' : 'IN_STOCK',
    showCost: hasCost,
    costLabel: hasCost ? formatMoney(toNumber(item.standardCost)) : null,
    balances: collapseBalancesByWarehouse(
      item.balances ?? [],
      locale,
      item.unit || 'pcs',
    ),
  };
}

export function selectInventoryItemDetail(
  item: InventoryItem,
  locale: string,
): InventoryItemDetailModel {
  const card = selectInventoryItemCard(item, locale);
  return {
    ...card,
    color: item.color ?? null,
    size: item.size ?? null,
    customMeasurements: item.customMeasurements ?? null,
    description: item.description ?? null,
    minStock: toNumber(item.minStock),
  };
}

export function selectInventoryTransaction(
  tx: InventoryTransaction,
  locale: string,
  unit: string,
): InventoryTransactionRow {
  const qty = toNumber(tx.quantity);
  const hasCost =
    tx.unitCost !== undefined && tx.unitCost !== null && String(tx.unitCost) !== '';
  const wh =
    locale === 'ar'
      ? tx.warehouse?.nameAr || tx.warehouse?.nameEn || tx.warehouse?.code
      : tx.warehouse?.nameEn || tx.warehouse?.nameAr || tx.warehouse?.code;

  return {
    id: tx.id,
    type: tx.type,
    quantityLabel: `${qty > 0 ? '+' : ''}${formatQty(qty)} ${unit}`,
    warehouseName: wh || '—',
    notes: tx.notes ?? null,
    createdAt: tx.createdAt,
    showCost: hasCost,
    costLabel: hasCost ? formatMoney(toNumber(tx.unitCost)) : null,
  };
}

export function isValidCategoryGroup(value: string): value is InventoryCategoryGroup {
  return value === 'fabric' || value === 'foam' || value === 'wood' || value === 'accessories';
}

export function formatInventoryMaterialType(
  type: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!type) return null;
  if (isValidCategoryGroup(type)) return t(`mobile.inventory.groups.${type}`);
  return type;
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-JO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  });
}
