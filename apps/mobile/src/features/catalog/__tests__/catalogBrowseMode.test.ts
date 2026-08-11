import { filterProductsForMode } from '../catalogBrowseMode';

describe('catalogBrowseMode', () => {
  const products = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('returns all products for all/ordered modes', () => {
    expect(filterProductsForMode(products, 'all', ['a'])).toEqual(products);
    expect(filterProductsForMode(products, 'ordered', ['a'])).toEqual(products);
  });

  it('filters to favorites only', () => {
    expect(filterProductsForMode(products, 'favorites', ['b', 'c'])).toEqual([
      { id: 'b' },
      { id: 'c' },
    ]);
    expect(filterProductsForMode(products, 'favorites', new Set(['a']))).toEqual([{ id: 'a' }]);
  });
});
