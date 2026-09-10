import { hasPermission } from '@maher/permissions';

/**
 * Floor workers may pick raw extras for a task, but not browse the inventory desk.
 */
export function inventoryItemListQueryForCaller<T extends { itemClass?: string }>(
  query: T,
  permissions: string[] | undefined,
): T {
  if (hasPermission(permissions ?? [], 'inventory.read')) return query;
  return { ...query, itemClass: 'RAW_MATERIAL' };
}

/** Floor extras may list RAW warehouses; they must not browse FIN/SEMI desks. */
export function warehouseListTypeForCaller(
  type: string | undefined,
  permissions: string[] | undefined,
): string | undefined {
  if (
    hasPermission(permissions ?? [], 'inventory.read') ||
    hasPermission(permissions ?? [], 'inventory.receive')
  ) {
    return type;
  }
  return 'RAW_MATERIALS';
}
