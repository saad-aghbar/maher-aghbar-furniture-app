import {
  rollupOrderType,
  parseManufacturingComplexity,
  tallyOrderTypeCounts,
} from '../manufacturing-complexity';

describe('rollupOrderType', () => {
  it('returns STANDARD for an empty line list', () => {
    expect(rollupOrderType([])).toBe('STANDARD');
  });

  it('returns STANDARD when every line is STANDARD', () => {
    expect(rollupOrderType(['STANDARD', 'STANDARD'])).toBe('STANDARD');
  });

  it('returns MODIFIED when any line is MODIFIED and none are CUSTOM', () => {
    expect(rollupOrderType(['STANDARD', 'MODIFIED'])).toBe('MODIFIED');
  });

  it('returns CUSTOM when any line is CUSTOM', () => {
    expect(rollupOrderType(['STANDARD', 'MODIFIED', 'CUSTOM'])).toBe('CUSTOM');
  });

  it('treats null complexity with a productId as STANDARD', () => {
    expect(
      rollupOrderType([{ manufacturingComplexity: null, productId: 'p1' }]),
    ).toBe('STANDARD');
  });

  it('treats null complexity without a productId as CUSTOM', () => {
    expect(rollupOrderType([null])).toBe('CUSTOM');
    expect(
      rollupOrderType([{ manufacturingComplexity: null, productId: null }]),
    ).toBe('CUSTOM');
  });
});

describe('parseManufacturingComplexity', () => {
  it('accepts enum values and rejects unknown', () => {
    expect(parseManufacturingComplexity('STANDARD')).toBe('STANDARD');
    expect(parseManufacturingComplexity('modified')).toBe('MODIFIED');
    expect(parseManufacturingComplexity('CUSTOM')).toBe('CUSTOM');
    expect(parseManufacturingComplexity(null)).toBeNull();
    expect(parseManufacturingComplexity('MIXED')).toBeNull();
  });
});

describe('tallyOrderTypeCounts', () => {
  it('splits rolled types without a MIXED bucket', () => {
    expect(
      tallyOrderTypeCounts(['STANDARD', 'MODIFIED', 'CUSTOM', 'MODIFIED']),
    ).toEqual({ standard: 1, modified: 2, custom: 1 });
  });
});
