import type { Warehouse } from './api';

/** Warehouse type / code preference for receiving stock by inventory category. */
export function preferredWarehouseTypeForCategory(category?: string | null): string {
  const cat = (category ?? '').toUpperCase();
  if (cat === 'FINISHED') return 'FINISHED';
  if (cat === 'SEMI_FINISHED') return 'SEMI';
  // Fabric, foam, wood, accessories, packaging, paint, etc. → raw materials
  return 'RAW';
}

function warehouseMatchesType(wh: Warehouse, preferredType: string): boolean {
  const type = (wh.type ?? '').toUpperCase();
  const code = (wh.code ?? '').toUpperCase();
  if (preferredType === 'RAW') {
    return type === 'RAW' || code === 'RAW';
  }
  if (preferredType === 'SEMI') {
    return type === 'SEMI' || code === 'SEMI';
  }
  if (preferredType === 'FINISHED') {
    return type === 'FINISHED' || code === 'FIN' || code === 'FINISHED';
  }
  return type === preferredType || code === preferredType;
}

/**
 * Pick the best warehouse when opening Add stock for a material.
 * Preference: category match → existing balance warehouse → first active.
 */
export function preferWarehouseForReceive(
  warehouses: Warehouse[],
  opts?: {
    category?: string | null;
    balanceWarehouseIds?: string[];
  },
): string {
  if (!warehouses.length) return '';

  const preferredType = preferredWarehouseTypeForCategory(opts?.category);
  const byCategory = warehouses.find((wh) => warehouseMatchesType(wh, preferredType));
  if (byCategory) return byCategory.id;

  for (const id of opts?.balanceWarehouseIds ?? []) {
    if (warehouses.some((wh) => wh.id === id)) return id;
  }

  return warehouses[0]?.id ?? '';
}

/**
 * Pick the best warehouse when opening Issue stock.
 * Preference: warehouse with the most on-hand → receive defaults.
 */
export function preferWarehouseForIssue(
  warehouses: Warehouse[],
  opts?: {
    category?: string | null;
    balances?: Array<{ warehouseId: string; availableQty: number }>;
  },
): string {
  if (!warehouses.length) return '';

  const withStock = [...(opts?.balances ?? [])]
    .filter((b) => b.availableQty > 0 && warehouses.some((wh) => wh.id === b.warehouseId))
    .sort((a, b) => b.availableQty - a.availableQty);

  if (withStock[0]) return withStock[0].warehouseId;

  return preferWarehouseForReceive(warehouses, {
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
