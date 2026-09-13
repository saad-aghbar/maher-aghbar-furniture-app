import {
  purchasingScanMissKey,
  selectSelectScanMode,
  selectVerifyScanKind,
} from '../selectScanPresentation';
import type { InventoryScanResolve } from '../resolveInventoryScan';

function r(status: InventoryScanResolve['status']): InventoryScanResolve {
  return { status } as InventoryScanResolve;
}

describe('selectSelectScanMode', () => {
  it('keeps catalog SKU as an item to confirm', () => {
    expect(selectSelectScanMode(r('FOUND'))).toBe('item');
  });

  it('names bin / kit / lot / fabric instead of not-found', () => {
    expect(selectSelectScanMode(r('FOUND_BIN'))).toBe('found-bin');
    expect(selectSelectScanMode(r('FOUND_KIT'))).toBe('found-kit');
    expect(selectSelectScanMode(r('FOUND_LOT'))).toBe('found-lot');
    expect(selectSelectScanMode(r('ORDER_FABRIC'))).toBe('order-fabric');
  });

  it('true miss and network stay distinct', () => {
    expect(selectSelectScanMode(r('NOT_FOUND'))).toBe('not-found');
    expect(selectSelectScanMode(r('ERROR'))).toBe('error');
  });
});

describe('selectVerifyScanKind', () => {
  it('names non-SKU identities', () => {
    expect(selectVerifyScanKind(r('FOUND'))).toBe('item');
    expect(selectVerifyScanKind(r('FOUND_BIN'))).toBe('SHELF');
    expect(selectVerifyScanKind(r('FOUND_KIT'))).toBe('KIT');
    expect(selectVerifyScanKind(r('FOUND_LOT'))).toBe('LOT');
    expect(selectVerifyScanKind(r('ORDER_FABRIC'))).toBe('ORDER_FABRIC');
    expect(selectVerifyScanKind(r('NOT_FOUND'))).toBe('UNKNOWN');
    expect(selectVerifyScanKind(r('ERROR'))).toBe('ERROR');
  });
});

describe('purchasingScanMissKey', () => {
  it('does not treat a shelf QR as a missing material', () => {
    expect(purchasingScanMissKey(r('FOUND_BIN'))).toBe('scanIsBinTitle');
    expect(purchasingScanMissKey(r('FOUND'))).toBeNull();
    expect(purchasingScanMissKey(r('NOT_FOUND'))).toBeNull();
  });
});
