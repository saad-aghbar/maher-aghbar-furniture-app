import {
  catalogNewOrderParams,
  customItemHref,
  customizeVariantHref,
  isJunkCatalogRouteId,
  isCatalogOrderDeepLink,
  navigateToBasketReview,
  navigateToCreateOrder,
  navigateToNewOrderWithProduct,
  newOrderHrefForProduct,
  parseDeepLinkProductId,
  parseDeepLinkQty,
  parseDeepLinkText,
  parseDeepLinkVariantId,
  resolveCustomizeProductId,
  resolveSelectedVariant,
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
  it('carries variant label and sku', () => {
    expect(
      catalogNewOrderParams('prod-abc', 1, 'v-ukr', {
        variantLabel: 'Ukrainian',
        variantSku: 'SOF-UKR',
      }),
    ).toEqual({
      productId: 'prod-abc',
      qty: '1',
      fromCatalog: '1',
      variantId: 'v-ukr',
      variantLabel: 'Ukrainian',
      variantSku: 'SOF-UKR',
    });
  });
});

describe('navigateToBasketReview', () => {
  it('opens the dedicated basket tab', () => {
    const router = {
      canDismiss: jest.fn(() => false),
      dismissAll: jest.fn(),
      navigate: jest.fn(),
      replace: jest.fn(),
    };
    navigateToBasketReview(router);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/(app)/(customer)/(tabs)/basket',
    });
  });
});

describe('navigateToCreateOrder', () => {
  it('opens New Order from the basket confirm CTA', () => {
    const router = {
      canDismiss: jest.fn(() => false),
      dismissAll: jest.fn(),
      navigate: jest.fn(),
      replace: jest.fn(),
    };
    navigateToCreateOrder(router);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/(app)/(customer)/(tabs)/new-order',
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

describe('customizeVariantHref', () => {
  it('opens the dealer modify desk beside custom item, not catalog/[id]', () => {
    expect(customizeVariantHref('prod-abc', 'v-olive', 2)).toEqual({
      pathname: '/(app)/(customer)/order/modify',
      params: {
        productId: 'prod-abc',
        variantId: 'v-olive',
        qty: '2',
      },
    });
  });

  it('carries a basket line id when editing from the basket', () => {
    expect(
      customizeVariantHref('prod-abc', 'v-olive', 2, { lineId: 'line-9' }),
    ).toEqual({
      pathname: '/(app)/(customer)/order/modify',
      params: {
        productId: 'prod-abc',
        variantId: 'v-olive',
        qty: '2',
        lineId: 'line-9',
      },
    });
  });
});

describe('resolveCustomizeProductId', () => {
  it('ignores Expo leftover static segments', () => {
    expect(isJunkCatalogRouteId('customize')).toBe(true);
    expect(resolveCustomizeProductId('customize', 'prod-abc')).toBe('prod-abc');
    expect(resolveCustomizeProductId('customize')).toBe('');
    expect(resolveCustomizeProductId('prod-abc')).toBe('prod-abc');
  });
});

describe('resolveSelectedVariant', () => {
  const rows = [
    { id: 'v-std', isDefault: true },
    { id: 'v-olive', isDefault: false },
  ];

  it('falls back to default when the requested id is missing', () => {
    expect(resolveSelectedVariant(rows, 'gone')?.id).toBe('v-std');
    expect(resolveSelectedVariant(rows, '')?.id).toBe('v-std');
    expect(resolveSelectedVariant(rows, 'v-olive')?.id).toBe('v-olive');
    expect(resolveSelectedVariant([], 'v-olive')).toBeNull();
  });
});

describe('customItemHref', () => {
  it('opens the custom piece desk', () => {
    expect(String(customItemHref())).toBe('/(app)/(customer)/order/custom');
    expect(String(customItemHref('line-4'))).toContain('lineId=line-4');
  });
});

describe('parseDeepLinkQty', () => {
  it('normalizes qty strings', () => {
    expect(parseDeepLinkQty('4')).toBe('4');
    expect(parseDeepLinkQty('0')).toBe('1');
    expect(parseDeepLinkQty(['12'])).toBe('12');
  });
});

describe('parseDeepLinkVariantId', () => {
  it('trims and unwraps arrays', () => {
    expect(parseDeepLinkVariantId(' v-250 ')).toBe('v-250');
    expect(parseDeepLinkVariantId(['v-std'])).toBe('v-std');
    expect(parseDeepLinkVariantId(undefined)).toBe('');
  });
});

describe('parseDeepLinkProductId', () => {
  it('trims and unwraps arrays', () => {
    expect(parseDeepLinkProductId(' abc ')).toBe('abc');
    expect(parseDeepLinkProductId(['x'])).toBe('x');
    expect(parseDeepLinkProductId(undefined)).toBe('');
  });
});

describe('parseDeepLinkText', () => {
  it('trims and unwraps arrays', () => {
    expect(parseDeepLinkText(' Ukrainian ')).toBe('Ukrainian');
    expect(parseDeepLinkText(['SOF-UKR'])).toBe('SOF-UKR');
    expect(parseDeepLinkText(undefined)).toBe('');
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
