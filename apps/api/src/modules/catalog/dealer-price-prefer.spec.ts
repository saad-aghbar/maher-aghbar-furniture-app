import { preferDealerPrice, mergeVariantDealerPrices } from './dealer-price-prefer';

describe('preferDealerPrice', () => {
  const rows = [
    { productId: 'p1', variantId: null, price: 100, currency: 'ILS' },
    { productId: 'p1', variantId: 'v-ukr', price: 140, currency: 'ILS' },
    { productId: 'p2', variantId: null, price: 80, currency: 'ILS' },
  ];

  it('prefers the matching variant row', () => {
    expect(preferDealerPrice(rows, 'p1', 'v-ukr')?.price).toBe(140);
  });

  it('falls back to the product-level row', () => {
    expect(preferDealerPrice(rows, 'p1', 'v-std')?.price).toBe(100);
    expect(preferDealerPrice(rows, 'p1')?.price).toBe(100);
  });
});

describe('mergeVariantDealerPrices', () => {
  it('lets variant rows override product-level per customer', () => {
    const merged = mergeVariantDealerPrices(
      [
        { customerId: 'c1', variantId: null, price: 100 },
        { customerId: 'c1', variantId: 'v-ukr', price: 140 },
        { customerId: 'c2', variantId: null, price: 90 },
      ],
      'v-ukr',
    );
    expect(merged).toEqual([
      { customerId: 'c1', variantId: 'v-ukr', price: 140 },
      { customerId: 'c2', variantId: null, price: 90 },
    ]);
  });
});
