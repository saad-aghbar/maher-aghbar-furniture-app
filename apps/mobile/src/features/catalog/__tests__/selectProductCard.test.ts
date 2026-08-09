import {
  assertProductCardSafe,
  toProductCard,
} from '../selectProductCard';
import { catalogProductsFixture } from '../fixtures';

describe('selectProductCard', () => {
  it('maps dealer price and availability without cost fields', () => {
    const card = toProductCard(catalogProductsFixture[0]!, 'en');
    expect(card.name).toBe('Modern Sofa');
    expect(card.price).toBe(850);
    expect(card.isAvailable).toBe(true);
    expect(card.categoryName).toBe('Sofas');
    expect(card.dimensionHint).toBe('220×85×90');
    assertProductCardSafe(card);
    expect(JSON.stringify(card)).not.toContain('manufacturingCost');
    expect(JSON.stringify(card)).not.toContain('basePrice');
    expect(JSON.stringify(card)).not.toContain('sku');
  });

  it('uses Arabic name when locale is ar', () => {
    const card = toProductCard(catalogProductsFixture[0]!, 'ar');
    expect(card.name).toBe('كنبة عصرية');
  });
});
