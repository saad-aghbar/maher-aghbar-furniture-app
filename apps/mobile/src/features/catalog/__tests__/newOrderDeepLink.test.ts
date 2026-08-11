import {
  catalogNewOrderParams,
  isCatalogOrderDeepLink,
  navigateToNewOrderWithProduct,
  newOrderHrefForProduct,
  parseDeepLinkProductId,
  parseDeepLinkQty,
} from '../newOrderDeepLink';
import { catalogDimensionsNote } from '../catalogDimensionsNote';

describe('newOrderHrefForProduct', () => {
  it('deep-links productId, qty, and fromCatalog into New Order', () => {
    const href = String(newOrderHrefForProduct('prod-abc', 3));
    expect(href).toContain('/(app)/(customer)/(tabs)/new-order');
    expect(href).toContain('productId=prod-abc');
    expect(href).toContain('qty=3');
    expect(href).toContain('fromCatalog=1');
  });

  it('encodes special characters in productId', () => {
    const href = String(newOrderHrefForProduct('a/b c', 1));
    expect(href).toContain(`productId=${encodeURIComponent('a/b c')}`);
  });

  it('clamps qty into 1..99', () => {
    expect(String(newOrderHrefForProduct('p1', 0))).toContain('qty=1');
    expect(String(newOrderHrefForProduct('p1', 150))).toContain('qty=99');
  });
});

describe('catalogNewOrderParams', () => {
  it('returns stable pathname params without query encoding', () => {
    expect(catalogNewOrderParams('prod-abc', 3)).toEqual({
      productId: 'prod-abc',
      qty: '3',
      fromCatalog: '1',
    });
  });
});

describe('navigateToNewOrderWithProduct', () => {
  it('dismisses nested stack then navigates with pathname params', () => {
    const router = {
      canDismiss: jest.fn(() => true),
      dismissAll: jest.fn(),
      navigate: jest.fn(),
      replace: jest.fn(),
    };
    navigateToNewOrderWithProduct(router, 'prod-1', 2);
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/(app)/(customer)/(tabs)/new-order',
      params: { productId: 'prod-1', qty: '2', fromCatalog: '1' },
    });
  });

  it('navigates without dismiss when not nested', () => {
    const router = {
      canDismiss: jest.fn(() => false),
      dismissAll: jest.fn(),
      navigate: jest.fn(),
      replace: jest.fn(),
    };
    navigateToNewOrderWithProduct(router, 'prod-1', 1);
    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });
});

describe('isCatalogOrderDeepLink', () => {
  it('detects catalog deep links', () => {
    expect(isCatalogOrderDeepLink({ productId: 'p1', fromCatalog: '1' })).toBe(true);
    expect(isCatalogOrderDeepLink({ productId: 'p1' })).toBe(true);
    expect(isCatalogOrderDeepLink({})).toBe(false);
    expect(isCatalogOrderDeepLink({ productId: '  ' })).toBe(false);
  });
});

describe('parseDeepLinkQty', () => {
  it('normalizes qty strings', () => {
    expect(parseDeepLinkQty('4')).toBe('4');
    expect(parseDeepLinkQty('0')).toBe('1');
    expect(parseDeepLinkQty(['12'])).toBe('12');
  });
});

describe('parseDeepLinkProductId', () => {
  it('trims and unwraps arrays', () => {
    expect(parseDeepLinkProductId(' abc ')).toBe('abc');
    expect(parseDeepLinkProductId(['x'])).toBe('x');
    expect(parseDeepLinkProductId(undefined)).toBe('');
  });
});

describe('catalogDimensionsNote', () => {
  it('formats W×H×D with seat when present', () => {
    expect(
      catalogDimensionsNote({ width: 220, height: 85, depth: 90, seatHeight: 45 }),
    ).toBe('W 220 × H 85 × D 90 × Seat 45 cm');
  });

  it('returns empty when no dims', () => {
    expect(catalogDimensionsNote({})).toBe('');
  });
});
