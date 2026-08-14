/**
 * Classification mapping for inventory lifecycle rearchitecture.
 * Shared by API, seeds, and backfill.
 */

export type WarehouseTypeValue = 'RAW_MATERIALS' | 'SEMI_FINISHED' | 'FINISHED_GOODS';
export type InventoryItemClassValue = 'RAW_MATERIAL' | 'SEMI_FINISHED_GOOD' | 'FINISHED_GOOD';
export type RawMaterialGroupValue = 'WOOD' | 'FABRIC' | 'FOAM' | 'ACCESSORIES';

export const WAREHOUSE_TYPES: WarehouseTypeValue[] = [
  'RAW_MATERIALS',
  'SEMI_FINISHED',
  'FINISHED_GOODS',
];

export const LEGACY_WAREHOUSE_TYPE_MAP: Record<string, WarehouseTypeValue> = {
  RAW: 'RAW_MATERIALS',
  RAW_MATERIALS: 'RAW_MATERIALS',
  SEMI: 'SEMI_FINISHED',
  SEMI_FINISHED: 'SEMI_FINISHED',
  FINISHED: 'FINISHED_GOODS',
  FINISHED_GOODS: 'FINISHED_GOODS',
  FIN: 'FINISHED_GOODS',
};

export function mapLegacyWarehouseType(
  type: string | null | undefined,
  code?: string | null,
): { type: WarehouseTypeValue; reviewRequired: boolean } {
  const key = String(type ?? '').trim().toUpperCase();
  const mapped = LEGACY_WAREHOUSE_TYPE_MAP[key];
  if (mapped) return { type: mapped, reviewRequired: false };
  const codeKey = String(code ?? '').trim().toUpperCase();
  if (codeKey === 'FIN' || codeKey === 'FINISHED') {
    return { type: 'FINISHED_GOODS', reviewRequired: false };
  }
  if (codeKey === 'RAW') return { type: 'RAW_MATERIALS', reviewRequired: false };
  if (codeKey === 'SEMI') return { type: 'SEMI_FINISHED', reviewRequired: false };
  return { type: 'RAW_MATERIALS', reviewRequired: true };
}

export function warehouseTypeForItemClass(itemClass: InventoryItemClassValue): WarehouseTypeValue {
  if (itemClass === 'SEMI_FINISHED_GOOD') return 'SEMI_FINISHED';
  if (itemClass === 'FINISHED_GOOD') return 'FINISHED_GOODS';
  return 'RAW_MATERIALS';
}

export function itemClassCompatibleWithWarehouse(
  itemClass: InventoryItemClassValue,
  warehouseType: WarehouseTypeValue,
): boolean {
  return warehouseTypeForItemClass(itemClass) === warehouseType;
}

const ACCESSORY_CATEGORIES = new Set([
  'METAL_ACCESSORY',
  'DECORATIVE_ACCESSORY',
  'PACKAGING',
  'PAINT',
  'ADHESIVE',
]);

export function classifyInventoryCategory(category: string | null | undefined): {
  itemClass: InventoryItemClassValue;
  materialGroup: RawMaterialGroupValue | null;
  reviewRequired: boolean;
  isPurchasable: boolean;
} {
  const cat = String(category ?? 'OTHER').toUpperCase();
  if (cat === 'WOOD') {
    return { itemClass: 'RAW_MATERIAL', materialGroup: 'WOOD', reviewRequired: false, isPurchasable: true };
  }
  if (cat === 'FABRIC') {
    return { itemClass: 'RAW_MATERIAL', materialGroup: 'FABRIC', reviewRequired: false, isPurchasable: true };
  }
  if (cat === 'FOAM') {
    return { itemClass: 'RAW_MATERIAL', materialGroup: 'FOAM', reviewRequired: false, isPurchasable: true };
  }
  if (ACCESSORY_CATEGORIES.has(cat)) {
    return { itemClass: 'RAW_MATERIAL', materialGroup: 'ACCESSORIES', reviewRequired: false, isPurchasable: true };
  }
  if (cat === 'SEMI_FINISHED') {
    return { itemClass: 'SEMI_FINISHED_GOOD', materialGroup: null, reviewRequired: false, isPurchasable: false };
  }
  if (cat === 'FINISHED') {
    return { itemClass: 'FINISHED_GOOD', materialGroup: null, reviewRequired: false, isPurchasable: false };
  }
  return { itemClass: 'RAW_MATERIAL', materialGroup: null, reviewRequired: true, isPurchasable: true };
}

export function skuPrefixForItemClass(
  itemClass: InventoryItemClassValue,
  materialGroup?: RawMaterialGroupValue | null,
  category?: string | null,
): string {
  if (itemClass === 'SEMI_FINISHED_GOOD') return 'WIP';
  if (itemClass === 'FINISHED_GOOD') return 'FG';
  if (materialGroup === 'FABRIC' || category === 'FABRIC') return 'FAB';
  if (materialGroup === 'FOAM' || category === 'FOAM') return 'FOAM';
  if (materialGroup === 'WOOD' || category === 'WOOD') return 'WOOD';
  if (materialGroup === 'ACCESSORIES') return 'ACC';
  return 'MAT';
}

export const DEFAULT_WAREHOUSE_SETTING_KEYS: Record<WarehouseTypeValue, string> = {
  RAW_MATERIALS: 'inventory.defaultWarehouse.RAW_MATERIALS',
  SEMI_FINISHED: 'inventory.defaultWarehouse.SEMI_FINISHED',
  FINISHED_GOODS: 'inventory.defaultWarehouse.FINISHED_GOODS',
};
