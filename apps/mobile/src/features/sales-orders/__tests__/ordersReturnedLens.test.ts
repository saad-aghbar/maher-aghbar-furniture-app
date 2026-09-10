import { buildAdminOrderListFilters, isReturnedOrderFocus } from '../ordersReturnedLens';

describe('buildAdminOrderListFilters', () => {
  it('never sends returned=true — Returned uses /returned-cases', () => {
    const filters = buildAdminOrderListFilters({
      sortBy: 'createdAt',
      sortDir: 'desc',
      q: 'RET',
      journeyBucket: 'preparing',
      orderType: 'returned',
    });
    expect(filters.returned).toBeUndefined();
    expect(filters.orderType).toBeUndefined();
    expect(filters.q).toBe('RET');
    expect(filters.journeyBucket).toBe('preparing');
  });

  it('sends STANDARD/MODIFIED/CUSTOM as orderType', () => {
    expect(
      buildAdminOrderListFilters({ orderType: 'modified' }).orderType,
    ).toBe('MODIFIED');
  });

  it('detects the returned lens', () => {
    expect(isReturnedOrderFocus('returned')).toBe(true);
    expect(isReturnedOrderFocus('standard')).toBe(false);
  });
});
