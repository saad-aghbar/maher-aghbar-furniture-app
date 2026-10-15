export type InventoryLifecycle = 'materials' | 'semiFinished' | 'finished';
export type InventoryCategoryGroup = 'fabric' | 'foam' | 'wood' | 'accessories';

export type InventoryDeepLink = {
  lifecycle: InventoryLifecycle;
  categoryGroup?: InventoryCategoryGroup;
};

const CATEGORY_GROUPS = new Set<InventoryCategoryGroup>(['fabric', 'foam', 'wood', 'accessories']);

/** `/inventory/[group]` and `?group=` share one inventory desk. */
export function inventoryDeepLink(group: string | null | undefined): InventoryDeepLink | null {
  const key = String(group ?? '').trim().toLowerCase();
  if (!key) return null;
  if (CATEGORY_GROUPS.has(key as InventoryCategoryGroup)) {
    return { lifecycle: 'materials', categoryGroup: key as InventoryCategoryGroup };
  }
  if (key === 'finished') return { lifecycle: 'finished' };
  if (key === 'semi' || key === 'semifinished' || key === 'semi-finished') return { lifecycle: 'semiFinished' };
  if (key === 'raw' || key === 'materials') return { lifecycle: 'materials' };
  return null;
}
