import {
  nextSkuFromExisting,
  skuPrefixForCategory,
  summarizeInventoryMeasurements,
} from './inventory-category.util';

describe('inventory SKU helpers', () => {
  it('maps categories to type prefixes', () => {
    expect(skuPrefixForCategory('FABRIC')).toBe('FAB');
    expect(skuPrefixForCategory('FOAM')).toBe('FOAM');
    expect(skuPrefixForCategory('WOOD')).toBe('WOOD');
    expect(skuPrefixForCategory('METAL_ACCESSORY')).toBe('ACC');
    expect(skuPrefixForCategory('DECORATIVE_ACCESSORY')).toBe('ACC');
    expect(skuPrefixForCategory()).toBe('MAT');
    expect(skuPrefixForCategory('OTHER')).toBe('MAT');
  });

  it('increments PREFIX-NNNN without using year', () => {
    expect(nextSkuFromExisting('FAB', [])).toBe('FAB-0001');
    expect(nextSkuFromExisting('FAB', ['FAB-0001', 'FAB-0009'])).toBe('FAB-0010');
    expect(nextSkuFromExisting('FOAM', ['FOAM-0003', 'FOAM-2026-00001'])).toBe(
      'FOAM-0004',
    );
  });
});

describe('summarizeInventoryMeasurements', () => {
  it('joins filled values with ×', () => {
    expect(
      summarizeInventoryMeasurements([
        { value: 200, unit: 'cm' },
        { value: 40, unit: 'cm' },
        { value: 10, unit: 'cm' },
      ]),
    ).toBe('200 cm × 40 cm × 10 cm');
  });

  it('skips empty rows', () => {
    expect(
      summarizeInventoryMeasurements([
        { value: null, unit: 'cm' },
        { value: 12, unit: 'm' },
      ]),
    ).toBe('12 m');
    expect(summarizeInventoryMeasurements([])).toBeNull();
  });
});
