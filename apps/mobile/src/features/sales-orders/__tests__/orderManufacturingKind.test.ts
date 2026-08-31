import {
  complexityBadgeKey,
  resolveOrderManufacturingKind,
} from '../orderManufacturingKind';

describe('orderManufacturingKind', () => {
  it('maps complexity strings', () => {
    expect(complexityBadgeKey('STANDARD')).toBe('standard');
    expect(complexityBadgeKey('MODIFIED')).toBe('modified');
    expect(complexityBadgeKey('CUSTOM')).toBe('custom');
    expect(complexityBadgeKey(null)).toBe('standard');
  });

  it('picks worst kind across lines', () => {
    expect(resolveOrderManufacturingKind(['STANDARD', 'MODIFIED'])).toBe('modified');
    expect(resolveOrderManufacturingKind(['MODIFIED', 'CUSTOM', 'STANDARD'])).toBe(
      'custom',
    );
    expect(resolveOrderManufacturingKind([])).toBe('standard');
  });
});
