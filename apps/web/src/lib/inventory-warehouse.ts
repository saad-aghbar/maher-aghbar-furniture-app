export type WarehouseBin = {
  id: string;
  code: string;
  name?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

export type Warehouse = {
  id: string;
  code: string;
  nameEn?: string;
  nameAr?: string;
  type?: string;
  locations?: WarehouseBin[];
};

export function binsForWarehouse(warehouses: Warehouse[], warehouseId: string): WarehouseBin[] {
  return (warehouses.find((w) => w.id === warehouseId)?.locations ?? []).filter(
    (loc) => loc.isActive !== false,
  );
}

export function defaultBinId(warehouses: Warehouse[], warehouseId: string, current?: string): string {
  const bins = binsForWarehouse(warehouses, warehouseId);
  if (current && bins.some((b) => b.id === current)) return current;
  return bins.find((b) => b.isDefault)?.id ?? bins[0]?.id ?? '';
}

export function warehouseTypeForItemClass(itemClass?: string | null, category?: string | null): string {
  const cls = (itemClass ?? '').toUpperCase();
  if (cls === 'SEMI_FINISHED_GOOD' || cls === 'SEMI_FINISHED') return 'SEMI_FINISHED';
  if (cls === 'FINISHED_GOOD' || cls === 'FINISHED_GOODS') return 'FINISHED_GOODS';
  if (cls === 'RAW_MATERIAL') return 'RAW_MATERIALS';
  const cat = (category ?? '').toUpperCase();
  if (cat === 'FINISHED' || cat === 'FINISHED_GOODS') return 'FINISHED_GOODS';
  if (cat === 'SEMI_FINISHED') return 'SEMI_FINISHED';
  return 'RAW_MATERIALS';
}

export function warehouseMatchesLifecycleType(wh: Warehouse, required: string): boolean {
  const type = (wh.type ?? '').toUpperCase();
  const code = (wh.code ?? '').toUpperCase();
  if (required === 'RAW_MATERIALS') {
    return type === 'RAW_MATERIALS' || type === 'RAW' || code === 'RAW';
  }
  if (required === 'SEMI_FINISHED') {
    return type === 'SEMI_FINISHED' || type === 'SEMI' || code === 'SEMI';
  }
  if (required === 'FINISHED_GOODS') {
    return type === 'FINISHED_GOODS' || type === 'FINISHED' || code === 'FIN' || code === 'FINISHED';
  }
  return type === required || code === required;
}

export function warehousesForItem(
  list: Warehouse[],
  item?: { itemClass?: string | null; category?: string | null } | null,
): Warehouse[] {
  if (!item) return list;
  const required = warehouseTypeForItemClass(item.itemClass, item.category);
  return list.filter((wh) => warehouseMatchesLifecycleType(wh, required));
}
