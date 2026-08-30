import { isApiError } from '@/api/errors';
import {
  getInventoryItemByCode,
  type InventoryItem,
} from '@/api/modules/inventory';

export type InventoryScanResolveStatus = 'FOUND' | 'NOT_FOUND' | 'ERROR';

export type InventoryScanResolve =
  | { status: 'FOUND'; item: InventoryItem }
  | { status: 'NOT_FOUND' }
  | { status: 'ERROR' };

/**
 * Inventory adapter over by-code lookup.
 * Forms must not interpret camera / HTTP details themselves.
 */
export async function resolveInventoryScan(code: string): Promise<InventoryScanResolve> {
  const trimmed = code.trim();
  if (!trimmed) return { status: 'NOT_FOUND' };
  try {
    const item = await getInventoryItemByCode(trimmed);
    return { status: 'FOUND', item };
  } catch (err) {
    if (isApiError(err) && (err.status === 404 || err.code === 'NOT_FOUND')) {
      return { status: 'NOT_FOUND' };
    }
    return { status: 'ERROR' };
  }
}

export function isInventoryItemSelectable(
  item: InventoryItem,
  allowItem?: (item: InventoryItem) => boolean,
): 'ok' | 'archived' | 'disallowed' {
  if (!item.isActive || item.archivedAt) return 'archived';
  if (allowItem && !allowItem(item)) return 'disallowed';
  return 'ok';
}
