import { InventoryCategory } from '@maher/database';

export type InventoryCategoryGroup = 'fabric' | 'foam' | 'wood' | 'accessories';

export const INVENTORY_CATEGORY_GROUPS: Record<InventoryCategoryGroup, InventoryCategory[]> = {
  fabric: [InventoryCategory.FABRIC],
  foam: [InventoryCategory.FOAM],
  wood: [InventoryCategory.WOOD],
  accessories: [
    InventoryCategory.METAL_ACCESSORY,
    InventoryCategory.DECORATIVE_ACCESSORY,
    InventoryCategory.PACKAGING,
  ],
};

const SKU_PREFIX_BY_CATEGORY: Record<string, string> = {
  FABRIC: 'FAB',
  FOAM: 'FOAM',
  WOOD: 'WOOD',
  METAL_ACCESSORY: 'ACC',
  DECORATIVE_ACCESSORY: 'ACC',
  PACKAGING: 'ACC',
};

export function categoriesForGroup(group?: string): InventoryCategory[] | undefined {
  if (!group) return undefined;
  const key = group.toLowerCase() as InventoryCategoryGroup;
  return INVENTORY_CATEGORY_GROUPS[key];
}

export function skuPrefixForCategory(category?: string): string {
  if (!category) return 'MAT';
  return SKU_PREFIX_BY_CATEGORY[category] ?? 'MAT';
}

/** Next SKU like FAB-0001 from existing PREFIX-NNNN codes. */
export function nextSkuFromExisting(prefix: string, skus: string[]): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}-(\\d+)$`);
  let max = 0;
  for (const sku of skus) {
    const match = sku.match(re);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export function summarizeInventoryMeasurements(
  rows:
    | Array<{ value?: number | null; unit?: string | null }>
    | null
    | undefined,
): string | null {
  if (!rows?.length) return null;
  const parts: string[] = [];
  for (const row of rows) {
    if (row.value == null || !Number.isFinite(Number(row.value))) continue;
    const unit = String(row.unit ?? 'cm').trim() || 'cm';
    parts.push(`${row.value} ${unit}`);
  }
  return parts.length ? parts.join(' × ') : null;
}
