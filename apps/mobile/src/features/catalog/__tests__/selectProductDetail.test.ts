import {
  assertProductDetailSafe,
  selectProductDetail,
} from '../selectProductDetail';
import { catalogProductsFixture } from '../fixtures';
import type { BrowseProduct } from '../api';

describe('selectProductDetail', () => {
  it('maps dealer price, dimensions, and strips cost keys', () => {
    const vm = selectProductDetail(catalogProductsFixture[0]!, 'en');
    expect(vm.name).toBe('Modern Sofa');
    expect(vm.price).toBe(850);
    expect(vm.sku).toBe('SF-001');
    expect(vm.categoryName).toBe('Sofas');
    expect(vm.categoryId).toBe('cat1');
    expect(vm.description).toContain('3-seater');
    expect(vm.dimensions.length).toBeGreaterThanOrEqual(4);
    expect(vm.dimensions.map((d) => d.kind)).toEqual(
      expect.arrayContaining(['w', 'h', 'd', 'seat']),
    );
    expect(vm.dimensionSummary).toMatch(/cm/);
    assertProductDetailSafe(vm);
    expect(JSON.stringify(vm)).not.toContain('manufacturingCost');
    expect(JSON.stringify(vm)).not.toContain('basePrice');
  });

  it('uses dealerPrice path when it differs from price', () => {
    const product: BrowseProduct = {
      ...catalogProductsFixture[0]!,
      price: 1200,
      dealerPrice: 880,
    };
    const vm = selectProductDetail(product, 'en');
    expect(vm.price).toBe(880);
    assertProductDetailSafe(vm);
  });

  it('never exposes manufacturing cost even if present on raw object', () => {
    const leaky = {
      ...catalogProductsFixture[0]!,
      manufacturingCost: 200,
      basePrice: 500,
    } as BrowseProduct & { manufacturingCost: number; basePrice: number };
    const vm = selectProductDetail(leaky, 'en');
    assertProductDetailSafe(vm);
    expect(vm).not.toHaveProperty('manufacturingCost');
    expect(vm).not.toHaveProperty('basePrice');
    expect(JSON.stringify(vm)).not.toMatch(/manufacturingCost|basePrice|bomDefaults/);
  });

  it('uses Arabic name for ar locale', () => {
    const vm = selectProductDetail(catalogProductsFixture[0]!, 'ar');
    expect(vm.name).toBe('كنبة عصرية');
  });
});
