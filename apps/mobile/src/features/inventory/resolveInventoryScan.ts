import { isApiError } from '@/api/errors';
import {
  getInventoryItemByCode,
  getInventoryLotByCode,
  getWipKitByCode,
  type InventoryItem,
  type SemiFinishedLot,
  type WipKitCard,
} from '@/api/modules/inventory';

export type InventoryScanResolveStatus =
  | 'FOUND'
  | 'FOUND_KIT'
  | 'FOUND_LOT'
  | 'ORDER_FABRIC'
  | 'NOT_FOUND'
  | 'ERROR';

export type InventoryScanResolve =
  | { status: 'FOUND'; item: InventoryItem }
  | { status: 'FOUND_KIT'; kit: WipKitCard }
  | { status: 'FOUND_LOT'; lot: SemiFinishedLot }
  | { status: 'ORDER_FABRIC'; lot: SemiFinishedLot }
  | { status: 'NOT_FOUND' }
  | { status: 'ERROR' };

function isNotFoundErr(err: unknown): boolean {
  if (!isApiError(err)) return false;
  return (
    err.status === 404 ||
    err.code === 'NOT_FOUND' ||
    err.code === 'WIP_SCAN_NOT_FOUND' ||
    err.code === 'SCAN_REQUIRED'
  );
}

/**
 * Universal inventory Identify resolver.
 * Prefer physical kit / lot identity over collapsing SEMI/FIN to SKU balances.
 * SELECT / VERIFY / purchasing callers must accept only `FOUND` (item SKU).
 */
export async function resolveInventoryScan(code: string): Promise<InventoryScanResolve> {
  const trimmed = code.trim();
  if (!trimmed) return { status: 'NOT_FOUND' };

  try {
    const kit = await getWipKitByCode(trimmed);
    return { status: 'FOUND_KIT', kit };
  } catch (err) {
    if (!isNotFoundErr(err)) {
      if (isApiError(err) && err.status >= 400 && err.status < 500) {
        // continue — e.g. malformed path
      } else {
        return { status: 'ERROR' };
      }
    }
  }

  try {
    const lot = await getInventoryLotByCode(trimmed);
    const kind = String((lot as { scanKind?: string | null }).scanKind ?? '');
    const isFabric =
      kind === 'ORDER_FABRIC' ||
      Boolean((lot as { fabricProcurement?: { id?: string } | null }).fabricProcurement?.id) ||
      String(lot.qrCode ?? '').startsWith('FB-');
    if (isFabric) return { status: 'ORDER_FABRIC', lot };
    return { status: 'FOUND_LOT', lot };
  } catch (err) {
    if (!isNotFoundErr(err)) {
      if (isApiError(err) && err.status >= 400 && err.status < 500) {
        // continue
      } else {
        return { status: 'ERROR' };
      }
    }
  }

  try {
    const item = await getInventoryItemByCode(trimmed);
    return { status: 'FOUND', item };
  } catch (err) {
    if (isNotFoundErr(err)) {
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

/** True when lot belongs to finished goods (vs SEMI warehouse lot). */
export function isFinishedScanLot(lot: SemiFinishedLot): boolean {
  const cls = (lot.inventoryItem as { itemClass?: string }).itemClass;
  if (cls === 'FINISHED_GOOD') return true;
  if (cls === 'SEMI_FINISHED_GOOD') return false;
  const cat = (lot.inventoryItem as { category?: string }).category;
  return String(cat ?? '').toUpperCase() === 'FINISHED';
}
