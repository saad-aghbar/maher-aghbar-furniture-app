import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PRODUCT_DETAIL_HERO_DESK_MAX,
  PRODUCT_DETAIL_HERO_PHONE_MAX,
  productDetailHeroHeight,
} from '../productDetailHeroLayout';

describe('productDetailHeroLayout', () => {
  it('keeps the phone PDP as a square of the pane', () => {
    expect(productDetailHeroHeight(390)).toBe(390);
    expect(productDetailHeroHeight(430)).toBe(PRODUCT_DETAIL_HERO_PHONE_MAX);
  });

  it('caps the iPad split pane instead of a window-sized square', () => {
    expect(productDetailHeroHeight(580)).toBe(PRODUCT_DETAIL_HERO_DESK_MAX);
    expect(productDetailHeroHeight(1366)).toBe(PRODUCT_DETAIL_HERO_DESK_MAX);
    expect(productDetailHeroHeight(1366)).toBeLessThan(1366);
  });

  it('does not grow past the phone max on a short-wide phone landscape', () => {
    expect(productDetailHeroHeight(852)).toBe(PRODUCT_DETAIL_HERO_DESK_MAX);
    expect(productDetailHeroHeight(390, 1)).toBeLessThanOrEqual(
      PRODUCT_DETAIL_HERO_PHONE_MAX,
    );
  });
});

describe('dealer PDP hero wiring', () => {
  it('sizes the carousel from the pane, not the window', () => {
    const carousel = readFileSync(
      join(__dirname, '../components/ProductImageCarousel.tsx'),
      'utf8',
    );
    expect(carousel).toContain('productDetailHeroHeight');
    expect(carousel).toContain('onLayout');
    expect(carousel).not.toContain('useWindowMetrics');
    expect(carousel).toContain('embedded');
  });

  it('hides the overlay back control when the PDP is in the catalog side pane', () => {
    const pdp = readFileSync(join(__dirname, '../ProductDetailScreen.tsx'), 'utf8');
    expect(pdp).toContain('embedded={embedded}');
    expect(pdp).toContain('onBack={embedded ? undefined : () => router.back()}');
  });
});
