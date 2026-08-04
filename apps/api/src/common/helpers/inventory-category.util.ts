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

export function categoriesForGroup(group?: string): InventoryCategory[] | undefined {
  if (!group) return undefined;
  const key = group.toLowerCase() as InventoryCategoryGroup;
  return INVENTORY_CATEGORY_GROUPS[key];
}
