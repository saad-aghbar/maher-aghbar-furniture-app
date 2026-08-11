import {
  assertProductCardSafe,
  resolveDealerBrowsePrice,
  toProductCard,
} from '../selectProductCard';
import { catalogProductsFixture } from '../fixtures';
import type { BrowseProduct } from '../api';

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

  it('prefers dealerPrice over list price', () => {
    const product: BrowseProduct = {
      ...catalogProductsFixture[0]!,
      price: 999,
      dealerPrice: 720,
    };
    expect(resolveDealerBrowsePrice(product)).toBe(720);
    expect(toProductCard(product, 'en').price).toBe(720);
  });

  it('falls back to price when dealerPrice is null', () => {
    const product: BrowseProduct = {
      ...catalogProductsFixture[0]!,
      price: 640,
      dealerPrice: null,
    };
    expect(toProductCard(product, 'en').price).toBe(640);
  });

  it('prefers thumbnailUrl for card media', () => {
    const product: BrowseProduct = {
      ...catalogProductsFixture[0]!,
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
      imageUrl: 'https://cdn.example/full.jpg',
    };
    const card = toProductCard(product, 'en');
    expect(card.imageUrl).toBe('https://cdn.example/thumb.jpg');
  });

  it('uses Arabic name when locale is ar', () => {
    const card = toProductCard(catalogProductsFixture[0]!, 'ar');
    expect(card.name).toBe('كنبة عصرية');
  });
});
