import type { Warehouse } from './api';

export type InventoryLifecycleClass =
  | 'RAW_MATERIAL'
  | 'SEMI_FINISHED_GOOD'
  | 'FINISHED_GOOD';

export type WarehouseLifecycleType = 'RAW_MATERIALS' | 'SEMI_FINISHED' | 'FINISHED_GOODS';

export type InventoryLifecycle = 'materials' | 'semiFinished' | 'finished';

/** Warehouse type required by an inventory item's lifecycle class. */
export function warehouseTypeForItemClass(
  itemClass?: string | null,
  category?: string | null,
): WarehouseLifecycleType {
  const cls = (itemClass ?? '').toUpperCase();
  if (cls === 'SEMI_FINISHED_GOOD' || cls === 'SEMI_FINISHED') return 'SEMI_FINISHED';
  if (cls === 'FINISHED_GOOD' || cls === 'FINISHED_GOODS') return 'FINISHED_GOODS';
  if (cls === 'RAW_MATERIAL') return 'RAW_MATERIALS';
  return preferredWarehouseTypeForCategory(category);
}

/** Warehouse type preference for receiving stock by inventory category. */
export function preferredWarehouseTypeForCategory(category?: string | null): WarehouseLifecycleType {
  const cat = (category ?? '').toUpperCase();
  if (cat === 'FINISHED' || cat === 'FINISHED_GOODS') return 'FINISHED_GOODS';
  if (cat === 'SEMI_FINISHED') return 'SEMI_FINISHED';
  return 'RAW_MATERIALS';
}

export function warehouseMatchesType(wh: Warehouse, preferredType: string): boolean {
  const type = (wh.type ?? '').toUpperCase();
  const code = (wh.code ?? '').toUpperCase();
  if (preferredType === 'RAW_MATERIALS') {
    return type === 'RAW_MATERIALS' || type === 'RAW' || code === 'RAW';
  }
  if (preferredType === 'SEMI_FINISHED') {
    return type === 'SEMI_FINISHED' || type === 'SEMI' || code === 'SEMI';
  }
  if (preferredType === 'FINISHED_GOODS') {
    return (
      type === 'FINISHED_GOODS' ||
      type === 'FINISHED' ||
      code === 'FIN' ||
      code === 'FINISHED'
    );
  }
  return type === preferredType || code === preferredType;
}

/** Warehouse type required by the Inventory lifecycle tab. */
export function warehouseTypeForLifecycle(
  lifecycle: InventoryLifecycle,
): WarehouseLifecycleType {
  if (lifecycle === 'semiFinished') return 'SEMI_FINISHED';
  if (lifecycle === 'finished') return 'FINISHED_GOODS';
  return 'RAW_MATERIALS';
}

/** Item class that Transfer / Stock Count pickers must query for a lifecycle tab. */
export function itemClassForLifecycle(
  lifecycle: InventoryLifecycle,
): InventoryLifecycleClass {
  if (lifecycle === 'semiFinished') return 'SEMI_FINISHED_GOOD';
  if (lifecycle === 'finished') return 'FINISHED_GOOD';
  return 'RAW_MATERIAL';
}

/** Hide warehouses that cannot participate in this lifecycle's transfer/count. */
export function warehousesForLifecycle(
  warehouses: Warehouse[],
  lifecycle: InventoryLifecycle,
): Warehouse[] {
  const required = warehouseTypeForLifecycle(lifecycle);
  return warehouses.filter((wh) => warehouseMatchesType(wh, required));
}

/**
 * Hide warehouses that cannot store this item. Receive/issue pickers must
 * not list incompatible destinations — disabling them is not enough.
 */
export function warehousesCompatibleWithItem(
  warehouses: Warehouse[],
  opts?: { itemClass?: string | null; category?: string | null },
): Warehouse[] {
  if (!opts || (!opts.itemClass && !opts.category)) return warehouses;
  const required = warehouseTypeForItemClass(opts.itemClass, opts.category);
  return warehouses.filter((wh) => warehouseMatchesType(wh, required));
}

type ReceivePreferOpts = {
  itemClass?: string | null;
  category?: string | null;
  balanceWarehouseIds?: string[];
};

/**
 * Pick the best warehouse when opening Add stock for a material.
 * Preference: compatible type → existing compatible balance → first compatible.
 */
export function preferWarehouseForReceive(
  warehouses: Warehouse[],
  opts?: ReceivePreferOpts,
): string {
  const compatible = warehousesCompatibleWithItem(warehouses, opts);
  if (!compatible.length) return '';

  const preferredType = warehouseTypeForItemClass(opts?.itemClass, opts?.category);
  const byType = compatible.find((wh) => warehouseMatchesType(wh, preferredType));
  if (byType) return byType.id;

  for (const id of opts?.balanceWarehouseIds ?? []) {
    if (compatible.some((wh) => wh.id === id)) return id;
  }

  return compatible[0]?.id ?? '';
}

/**
 * Pick the best warehouse when opening Issue stock.
 * Preference: compatible warehouse with the most on-hand → receive defaults.
 */
export function preferWarehouseForIssue(
  warehouses: Warehouse[],
  opts?: {
    itemClass?: string | null;
    category?: string | null;
    balances?: Array<{ warehouseId: string; availableQty: number }>;
  },
): string {
  const compatible = warehousesCompatibleWithItem(warehouses, opts);
  if (!compatible.length) return '';

  const withStock = [...(opts?.balances ?? [])]
    .filter((b) => b.availableQty > 0 && compatible.some((wh) => wh.id === b.warehouseId))
    .sort((a, b) => b.availableQty - a.availableQty);

  if (withStock[0]) return withStock[0].warehouseId;

  return preferWarehouseForReceive(compatible, {
    itemClass: opts?.itemClass,
    category: opts?.category,
    balanceWarehouseIds: (opts?.balances ?? []).map((b) => b.warehouseId),
  });
}

/** Sort warehouses so the preferred receive/issue target appears first. */
export function sortWarehousesForReceive(
  warehouses: Warehouse[],
  preferredId: string,
): Warehouse[] {
  if (!preferredId) return warehouses;
  const preferred = warehouses.find((wh) => wh.id === preferredId);
  if (!preferred) return warehouses;
  return [preferred, ...warehouses.filter((wh) => wh.id !== preferredId)];
}
