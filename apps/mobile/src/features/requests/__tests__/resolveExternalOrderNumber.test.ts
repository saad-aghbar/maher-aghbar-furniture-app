import { resolveExternalOrderNumber } from '../resolveExternalOrderNumber';

describe('resolveExternalOrderNumber', () => {
  it('prefers the dealer PO when provided', () => {
    expect(resolveExternalOrderNumber('PO-9', 'RFQ-1')).toBe('PO-9');
    expect(resolveExternalOrderNumber('  PO-9  ', 'RFQ-1')).toBe('PO-9');
  });

  it('falls back to the factory RFQ number when dealer PO is blank', () => {
    expect(resolveExternalOrderNumber('', 'RFQ-42')).toBe('RFQ-42');
    expect(resolveExternalOrderNumber('   ', 'RFQ-42')).toBe('RFQ-42');
    expect(resolveExternalOrderNumber(undefined, 'RFQ-42')).toBe('RFQ-42');
  });

  it('returns undefined when both are blank', () => {
    expect(resolveExternalOrderNumber('', '')).toBeUndefined();
    expect(resolveExternalOrderNumber(null, null)).toBeUndefined();
  });
});
