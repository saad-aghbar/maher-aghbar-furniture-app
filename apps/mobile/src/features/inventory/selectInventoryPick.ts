import type {
  InventoryCategoryGroup,
  InventoryItem,
} from './api';
import {
  itemClassForLifecycle,
  type InventoryLifecycle,
  type InventoryLifecycleClass,
} from './preferWarehouseForReceive';

export type InventoryPickMode = 'transfer' | 'count';

export type InventoryPickQuery = {
  page: number;
  pageSize: number;
  itemClass: InventoryLifecycleClass;
  warehouseId: string;
  categoryGroup?: InventoryCategoryGroup;
  q?: string;
};

export type WarehouseScopedQty = {
  onHandQty: number;
  reservedQty: number;
  freeQty: number;
};

export type InventoryPickRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  productName: string | null;
  imageUrl: string | null;
  onHandQty: number;
  reservedQty: number;
  freeQty: number;
  /** Qty shown / allowed for this pick mode context. */
  displayQty: number;
  transferable: boolean;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function showsRawCategoryRail(lifecycle: InventoryLifecycle): boolean {
  return lifecycle === 'materials';
}

/** Query params for Transfer / Stock Count item pickers. Never uses RAW groups for SEMI/FG. */
export function buildInventoryPickQuery(opts: {
  lifecycle: InventoryLifecycle;
  warehouseId: string;
  categoryGroup?: InventoryCategoryGroup;
  q?: string;
  page?: number;
  pageSize?: number;
}): InventoryPickQuery {
  const query: InventoryPickQuery = {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 80,
    itemClass: itemClassForLifecycle(opts.lifecycle),
    warehouseId: opts.warehouseId,
  };
  if (opts.q) query.q = opts.q;
  if (opts.lifecycle === 'materials' && opts.categoryGroup) {
    query.categoryGroup = opts.categoryGroup;
  }
  return query;
}

/** Qty held in one warehouse. Ignores balances in other warehouses. */
export function warehouseScopedQty(
  item: InventoryItem,
  warehouseId: string,
): WarehouseScopedQty {
  const balances = (item.balances ?? []).filter((b) => b.warehouseId === warehouseId);
  let onHandQty = 0;
  let reservedQty = 0;
  let freeQty = 0;
  for (const b of balances) {
    const onHand = toNumber(b.onHandQty ?? b.availableQty);
    const reserved = toNumber(b.reservedQty);
    onHandQty += onHand;
    reservedQty += reserved;
    freeQty += b.freeQty != null && b.freeQty !== '' ? toNumber(b.freeQty) : onHand - reserved;
  }
  return { onHandQty, reservedQty, freeQty };
}

/**
 * Qty that can leave a warehouse on a same-type transfer.
 * RAW: free only (do not pull BOM-reserved stock).
 * SEMI/FG: physical on-hand — order-allocated lots are reserved but still move with the bay.
 */
export function transferableQty(item: InventoryItem, warehouseId: string): number {
  const scoped = warehouseScopedQty(item, warehouseId);
  const cls = String(item.itemClass ?? '').toUpperCase();
  if (cls === 'FINISHED_GOOD' || cls === 'SEMI_FINISHED_GOOD' || cls === 'FINISHED_GOODS') {
    return Math.max(0, scoped.onHandQty);
  }
  return Math.max(0, scoped.freeQty);
}

export function isTransferableFromWarehouse(
  item: InventoryItem,
  warehouseId: string,
): boolean {
  return transferableQty(item, warehouseId) > 0;
}

export function filterPickableItems(
  items: InventoryItem[],
  opts: { warehouseId: string; mode: InventoryPickMode },
): InventoryItem[] {
  if (opts.mode === 'count') return items;
  return items.filter((item) => isTransferableFromWarehouse(item, opts.warehouseId));
}

function localizedItemName(item: InventoryItem, locale: string): string {
  if (locale === 'ar') return item.nameAr || item.nameEn || item.sku;
  if (locale === 'he') return item.nameHe || item.nameEn || item.nameAr || item.sku;
  return item.nameEn || item.nameAr || item.sku;
}

function localizedProductName(
  item: InventoryItem,
  locale: string,
): string | null {
  const product = item.product;
  if (!product) return null;
  if (locale === 'ar') return product.nameAr || product.nameEn || null;
  if (locale === 'he') return product.nameHe || product.nameEn || product.nameAr || null;
  return product.nameEn || product.nameAr || null;
}

export function selectInventoryPickRow(
  item: InventoryItem,
  warehouseId: string,
  locale: string,
): InventoryPickRow {
  const qty = warehouseScopedQty(item, warehouseId);
  const name = localizedItemName(item, locale);
  const productName = localizedProductName(item, locale);
  const displayQty = transferableQty(item, warehouseId);
  const imageUrl =
    item.imageUrl?.trim() ||
    item.product?.imageUrl?.trim() ||
    null;
  return {
    id: item.id,
    name,
    sku: item.sku,
    unit: item.unit || 'pcs',
    productName: productName && productName !== name ? productName : null,
    imageUrl,
    onHandQty: qty.onHandQty,
    reservedQty: qty.reservedQty,
    freeQty: qty.freeQty,
    displayQty,
    transferable: displayQty > 0,
  };
}

export function inventoryPickCopyKey(
  lifecycle: InventoryLifecycle,
): {
  item: string;
  pickItem: string;
  transferRequired: string;
  countRequired: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyBody: string;
  fallbackIcon: 'cube-outline' | 'layers-outline' | 'file-tray-stacked-outline';
} {
  if (lifecycle === 'semiFinished') {
    return {
      item: 'mobile.inventory.itemSemi',
      pickItem: 'mobile.inventory.pickSemiItem',
      transferRequired: 'mobile.inventory.transferRequiredSemi',
      countRequired: 'mobile.inventory.countRequiredSemi',
      searchLabel: 'mobile.inventory.searchSemiLabel',
      searchPlaceholder: 'mobile.inventory.searchSemiPlaceholder',
      emptyBody: 'mobile.inventory.emptySemiPickerBody',
      fallbackIcon: 'layers-outline',
    };
  }
  if (lifecycle === 'finished') {
    return {
      item: 'mobile.inventory.itemFinished',
      pickItem: 'mobile.inventory.pickFinishedItem',
      transferRequired: 'mobile.inventory.transferRequiredFinished',
      countRequired: 'mobile.inventory.countRequiredFinished',
      searchLabel: 'mobile.inventory.searchFinishedLabel',
      searchPlaceholder: 'mobile.inventory.searchFinishedPlaceholder',
      emptyBody: 'mobile.inventory.emptyFinishedPickerBody',
      fallbackIcon: 'cube-outline',
    };
  }
  return {
    item: 'mobile.inventory.item',
    pickItem: 'mobile.inventory.pickItem',
    transferRequired: 'mobile.inventory.transferRequired',
    countRequired: 'mobile.inventory.countRequired',
    searchLabel: 'mobile.inventory.searchMaterials',
    searchPlaceholder: 'mobile.inventory.searchPlaceholder',
    emptyBody: 'mobile.inventory.emptyMaterialsBody',
    fallbackIcon: 'file-tray-stacked-outline',
  };
}

export function formatPickQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}
