import { isCatalogPickForOrder, catalogPickForOrderHref } from '../catalogPickForOrder';

describe('catalogPickForOrder', () => {
  it('builds catalog pick href', () => {
    expect(String(catalogPickForOrderHref())).toContain('catalog');
    expect(String(catalogPickForOrderHref())).toContain('pickForOrder=1');
  });

  it('detects pick mode from params', () => {
    expect(isCatalogPickForOrder({ pickForOrder: '1' })).toBe(true);
    expect(isCatalogPickForOrder({ pickForOrder: 'true' })).toBe(true);
    expect(isCatalogPickForOrder({})).toBe(false);
    expect(isCatalogPickForOrder({ pickForOrder: '0' })).toBe(false);
  });
});
