import type { InventoryScanMatchKind } from './components/InventoryScanMatchResult';
import type { InlineScanSelectMode } from './components/InventoryScanSelectInline';
import type { InventoryScanResolve } from './resolveInventoryScan';

export type SelectScanMode =
  | Exclude<
      InlineScanSelectMode,
      'confirm' | 'blocked-type' | 'blocked-inactive'
    >
  | 'item';

/**
 * SELECT / Add-stock unknown-item: only a catalog SKU can be used as material.
 * Bin / kit / lot / fabric must not collapse to “item not found”.
 */
export function selectSelectScanMode(resolved: InventoryScanResolve): SelectScanMode {
  switch (resolved.status) {
    case 'FOUND':
      return 'item';
    case 'FOUND_BIN':
      return 'found-bin';
    case 'FOUND_KIT':
      return 'found-kit';
    case 'FOUND_LOT':
      return 'found-lot';
    case 'ORDER_FABRIC':
      return 'order-fabric';
    case 'ERROR':
      return 'error';
    default:
      return 'not-found';
  }
}

/**
 * VERIFY a known material label. Non-SKU identities are named, not UNKNOWN.
 */
export function selectVerifyScanKind(
  resolved: InventoryScanResolve,
): InventoryScanMatchKind | 'item' {
  switch (resolved.status) {
    case 'FOUND':
      return 'item';
    case 'FOUND_BIN':
      return 'SHELF';
    case 'FOUND_KIT':
      return 'KIT';
    case 'FOUND_LOT':
      return 'LOT';
    case 'ORDER_FABRIC':
      return 'ORDER_FABRIC';
    case 'ERROR':
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}

export function purchasingScanMissKey(
  resolved: InventoryScanResolve,
): 'scanIsBinTitle' | 'scanIsKitTitle' | 'scanIsLotTitle' | 'fabricScanNotStockTitle' | null {
  switch (resolved.status) {
    case 'FOUND_BIN':
      return 'scanIsBinTitle';
    case 'FOUND_KIT':
      return 'scanIsKitTitle';
    case 'FOUND_LOT':
      return 'scanIsLotTitle';
    case 'ORDER_FABRIC':
      return 'fabricScanNotStockTitle';
    default:
      return null;
  }
}
