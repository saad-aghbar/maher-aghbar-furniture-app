import {
  clampOrderQuantity,
  isCustomCatalogProduct,
} from '../newOrderProductKind';

describe('isCustomCatalogProduct', () => {
  it('is custom when name is set without productId', () => {
    expect(isCustomCatalogProduct('', 'Custom sofa')).toBe(true);
    expect(isCustomCatalogProduct(null, 'Custom sofa')).toBe(true);
    expect(isCustomCatalogProduct(undefined, '  Chair  ')).toBe(true);
  });

  it('is not custom when catalog productId is present', () => {
    expect(isCustomCatalogProduct('prod-1', 'Sofa')).toBe(false);
  });

  it('is not custom when name is empty', () => {
    expect(isCustomCatalogProduct('', '')).toBe(false);
    expect(isCustomCatalogProduct('', '   ')).toBe(false);
  });
});

describe('clampOrderQuantity', () => {
  it('clamps into 1..99', () => {
    expect(clampOrderQuantity(0)).toBe(1);
    expect(clampOrderQuantity(3)).toBe(3);
    expect(clampOrderQuantity(150)).toBe(99);
    expect(clampOrderQuantity('4')).toBe(4);
    expect(clampOrderQuantity('abc')).toBe(1);
  });
});
