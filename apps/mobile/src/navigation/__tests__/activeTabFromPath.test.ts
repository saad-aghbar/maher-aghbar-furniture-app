import { activeTabFromPath } from '../activeTabFromPath';

describe('activeTabFromPath', () => {
  it('selects more for bare and grouped more paths', () => {
    expect(activeTabFromPath('admin', '/more')).toBe('more');
    expect(activeTabFromPath('admin', '/(app)/(admin)/(tabs)/more')).toBe('more');
    expect(activeTabFromPath('admin', '/(tabs)/more')).toBe('more');
  });

  it('keeps home for index / root paths', () => {
    expect(activeTabFromPath('admin', '/')).toBe('index');
    expect(activeTabFromPath('admin', '/(app)/(admin)/(tabs)')).toBe('index');
    expect(activeTabFromPath('admin', '/(app)/(admin)/(tabs)/index')).toBe('index');
  });

  it('maps more-stack destinations to more, not home', () => {
    expect(activeTabFromPath('admin', '/(app)/(admin)/products')).toBe('more');
    expect(activeTabFromPath('admin', '/(app)/(admin)/dealers')).toBe('more');
    expect(activeTabFromPath('admin', '/notifications')).toBe('more');
    expect(activeTabFromPath('admin', '/search')).toBe('more');
    expect(activeTabFromPath('admin', '/(app)/(admin)/more/account')).toBe('more');
    expect(activeTabFromPath('admin', '/more/account')).toBe('more');
    expect(activeTabFromPath('admin', '/(app)/(admin)/scheduling')).toBe('more');
    expect(activeTabFromPath('admin', '/scheduling')).toBe('more');
  });

  it('maps primary tabs correctly when groups are stripped', () => {
    expect(activeTabFromPath('admin', '/orders')).toBe('orders');
    expect(activeTabFromPath('admin', '/inventory')).toBe('inventory');
    expect(activeTabFromPath('admin', '/production')).toBe('production');
  });

  it('maps orders hub nested routes to orders, not home', () => {
    expect(activeTabFromPath('admin', '/orders/abc-123')).toBe('orders');
    expect(activeTabFromPath('admin', '/(app)/(admin)/orders/abc-123')).toBe('orders');
    expect(activeTabFromPath('admin', '/requests/rfq-1')).toBe('orders');
    expect(activeTabFromPath('admin', '/(app)/(admin)/requests/rfq-1')).toBe('orders');
    expect(activeTabFromPath('admin', '/quotations/q-1')).toBe('orders');
    expect(activeTabFromPath('admin', '/(app)/(admin)/quotations/q-1')).toBe('orders');
  });

  it('maps dealer schedule and calendar onto Account, not a tab chip', () => {
    expect(activeTabFromPath('customer', '/schedule')).toBe('account');
    expect(activeTabFromPath('customer', '/(app)/(customer)/(tabs)/schedule')).toBe('account');
    expect(activeTabFromPath('customer', '/(app)/(customer)/account/calendar')).toBe('account');
  });
});
