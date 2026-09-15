import { applyUsbWedgeChar, emptyUsbWedge, isScanWorthy, normalizeScanCode } from '@maher/ui';
import { describe, expect, it } from 'vitest';

describe('normalizeScanCode', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeScanCode('  ABC  12  ')).toBe('ABC 12');
  });
});

describe('isScanWorthy', () => {
  it('rejects empty', () => {
    expect(isScanWorthy('   ')).toBe(false);
  });
  it('accepts a QR payload', () => {
    expect(isScanWorthy('WIP-KIT-001')).toBe(true);
  });
});

describe('applyUsbWedgeChar', () => {
  it('completes on Enter', () => {
    let state = emptyUsbWedge(0);
    for (const ch of 'KIT-9') {
      const next = applyUsbWedgeChar(state, ch, 10);
      state = next.state;
      expect(next.complete).toBeNull();
    }
    const done = applyUsbWedgeChar(state, 'Enter', 20);
    expect(done.complete).toBe('KIT-9');
  });

  it('resets after idle', () => {
    const first = applyUsbWedgeChar(emptyUsbWedge(0), 'A', 0);
    const afterIdle = applyUsbWedgeChar(first.state, 'B', 200);
    expect(afterIdle.state.buffer).toBe('B');
  });
});
