import { apiFetch } from './api-client';
import { resolveInventoryScan, type InventoryScanResolve } from './resolve-inventory-scan';

/**
 * Where a scanned code should take the user. Pure mapping from a resolved
 * scan to a route, so it can be unit-tested without the API.
 *
 * Resolve order (mobile parity): bin → WIP kit → lot (fabric / finished) → item.
 * Codes shaped like order/PO numbers short-circuit to their detail page.
 */
export type ScanSurface = 'admin' | 'worker';

export type ScanTarget =
  | { kind: 'route'; href: string; label: string }
  | { kind: 'unknown'; code: string }
  | { kind: 'error'; code: string };

const ORDER_NUMBER = /^(SO|RFQ|Q|QT|INV|PAY|PO|PR|GRN|RET|DEL|PRD|WO)-\d{4}-\d{3,}(\.[A-Z0-9]+)?$/i;

/** Sales-order style codes go straight to search, which resolves the exact entity. */
export function orderCodeTarget(code: string, surface: ScanSurface): ScanTarget | null {
  const trimmed = code.trim();
  if (!ORDER_NUMBER.test(trimmed)) return null;
  const base = surface === 'worker' ? '/worker' : '/admin';
  return { kind: 'route', href: `${base}/search?q=${encodeURIComponent(trimmed)}`, label: trimmed };
}

export function targetFromResolve(code: string, result: InventoryScanResolve, _surface: ScanSurface): ScanTarget {
  // Inventory entities live under /admin for every staff surface; workers with
  // inventory permission land on the same pages.
  switch (result.status) {
    case 'FOUND':
      return { kind: 'route', href: `/admin/inventory/items/${result.item.id}`, label: result.item.sku };
    case 'FOUND_KIT':
      return {
        kind: 'route',
        href: result.kit.productionOrderId ? `/admin/production/${result.kit.productionOrderId}` : '/admin/inventory',
        label: result.kit.qrCode ?? code,
      };
    case 'FOUND_LOT':
      return {
        kind: 'route',
        href: result.lot.salesOrderId ? `/admin/inventory/finished/${result.lot.salesOrderId}` : '/admin/inventory',
        label: result.lot.qrCode ?? code,
      };
    case 'ORDER_FABRIC':
      return { kind: 'route', href: `/admin/inventory/fabric-bundle/${encodeURIComponent(result.lot.qrCode ?? code)}`, label: result.lot.qrCode ?? code };
    case 'FOUND_BIN': {
      const warehouseId = result.bin.location?.warehouseId;
      return { kind: 'route', href: warehouseId ? `/admin/inventory/warehouses/${warehouseId}` : '/admin/warehouses', label: code };
    }
    case 'ERROR':
      return { kind: 'error', code };
    default:
      return { kind: 'unknown', code };
  }
}

type ProductSkuRow = { id: string; sku: string; nameEn?: string | null };

/** Exact catalog SKU only. A contains-match must not open a different product. */
export function matchProductSku(code: string, rows: ProductSkuRow[]): ScanTarget | null {
  const wanted = code.trim().toLowerCase();
  if (!wanted) return null;
  const hit = rows.find((row) => row.sku.trim().toLowerCase() === wanted);
  if (!hit?.id) return null;
  return {
    kind: 'route',
    href: `/admin/products/${hit.id}`,
    label: hit.nameEn?.trim() || hit.sku,
  };
}

async function productSkuTarget(code: string): Promise<ScanTarget | null> {
  try {
    const page = await apiFetch<{ data?: ProductSkuRow[] }>(
      `/api/v1/products?q=${encodeURIComponent(code.trim())}&pageSize=20`,
    );
    return matchProductSku(code, page.data ?? []);
  } catch {
    return null;
  }
}

/** Resolve a scanned code against the API and pick its route. */
export async function routeForScan(code: string, surface: ScanSurface = 'admin'): Promise<ScanTarget> {
  const direct = orderCodeTarget(code, surface);
  if (direct) return direct;
  const result = await resolveInventoryScan(code);
  const target = targetFromResolve(code, result, surface);
  if (target.kind !== 'unknown') return target;
  return (await productSkuTarget(code)) ?? target;
}
