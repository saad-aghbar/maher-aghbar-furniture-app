import {
  assertProductDetailSafe,
  selectProductDetail,
} from '../selectProductDetail';
import { catalogProductsFixture } from '../fixtures';

describe('selectProductDetail', () => {
  it('maps dealer price, dimensions, and strips cost keys', () => {
    const vm = selectProductDetail(catalogProductsFixture[0]!, 'en');
    expect(vm.name).toBe('Modern Sofa');
    expect(vm.price).toBe(850);
    expect(vm.categoryName).toBe('Sofas');
    expect(vm.description).toContain('3-seater');
    expect(vm.dimensions.length).toBeGreaterThan(0);
    assertProductDetailSafe(vm);
    expect(JSON.stringify(vm)).not.toContain('sku');
  });

  it('uses Arabic name for ar locale', () => {
    const vm = selectProductDetail(catalogProductsFixture[0]!, 'ar');
    expect(vm.name).toBe('كنبة عصرية');
  });
});
