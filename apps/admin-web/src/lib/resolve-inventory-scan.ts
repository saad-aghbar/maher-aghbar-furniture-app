import { parseBinScanCode } from '@maher/types';
import { ApiClientError, apiFetch } from './api-client';

export type InventoryScanResolve =
  | { status: 'FOUND'; item: { id: string; sku: string } }
  | { status: 'FOUND_KIT'; kit: { id: string; qrCode?: string; productionOrderId?: string } }
  | { status: 'FOUND_LOT'; lot: { id: string; qrCode?: string; salesOrderId?: string | null } }
  | { status: 'FOUND_BIN'; bin: { location?: { id: string; warehouseId?: string } } }
  | { status: 'ORDER_FABRIC'; lot: { id: string; qrCode?: string } }
  | { status: 'NOT_FOUND' }
  | { status: 'ERROR' };

function isNotFound(err: unknown): boolean {
  if (!(err instanceof ApiClientError)) return false;
  const code = err.body?.code;
  return (
    err.status === 404 ||
    code === 'NOT_FOUND' ||
    code === 'WIP_SCAN_NOT_FOUND' ||
    code === 'SCAN_REQUIRED'
  );
}

export async function resolveInventoryScan(code: string): Promise<InventoryScanResolve> {
  const trimmed = code.trim();
  if (!trimmed) return { status: 'NOT_FOUND' };

  if (parseBinScanCode(trimmed).kind === 'bin') {
    try {
      const bin = await apiFetch<InventoryScanResolve extends never ? never : { location?: { id: string } }>(
        `/api/v1/warehouses/locations/by-code/${encodeURIComponent(trimmed)}`,
      );
      return { status: 'FOUND_BIN', bin };
    } catch (err) {
      if (!isNotFound(err) && !(err instanceof ApiClientError && err.status >= 400 && err.status < 500)) {
        return { status: 'ERROR' };
      }
    }
  }

  try {
    const kit = await apiFetch<{ id: string; qrCode?: string; productionOrderId?: string }>(
      `/api/v1/inventory/wip-kits/by-code/${encodeURIComponent(trimmed)}`,
    );
    return { status: 'FOUND_KIT', kit };
  } catch (err) {
    if (!isNotFound(err) && !(err instanceof ApiClientError && err.status >= 400 && err.status < 500)) {
      return { status: 'ERROR' };
    }
  }

  try {
    const lot = await apiFetch<{
      id: string;
      qrCode?: string;
      scanKind?: string | null;
      fabricProcurement?: { id?: string } | null;
    }>(`/api/v1/inventory/lots/by-code/${encodeURIComponent(trimmed)}`);
    const kind = String(lot.scanKind ?? '');
    const isFabric =
      kind === 'ORDER_FABRIC' || Boolean(lot.fabricProcurement?.id) || String(lot.qrCode ?? '').startsWith('FB-');
    if (isFabric) return { status: 'ORDER_FABRIC', lot };
    return { status: 'FOUND_LOT', lot };
  } catch (err) {
    if (!isNotFound(err) && !(err instanceof ApiClientError && err.status >= 400 && err.status < 500)) {
      return { status: 'ERROR' };
    }
  }

  try {
    const item = await apiFetch<{ id: string; sku: string }>(
      `/api/v1/inventory/items/by-code/${encodeURIComponent(trimmed)}`,
    );
    return { status: 'FOUND', item };
  } catch (err) {
    if (isNotFound(err)) return { status: 'NOT_FOUND' };
    return { status: 'ERROR' };
  }
}
