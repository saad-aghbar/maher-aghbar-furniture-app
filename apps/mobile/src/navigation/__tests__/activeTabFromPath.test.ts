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
    expect(activeTabFromPath('admin', '/(app)/(admin)/invoices')).toBe('more');
    expect(activeTabFromPath('admin', '/(app)/(admin)/reports')).toBe('more');
    expect(activeTabFromPath('admin', '/(app)/(admin)/more/account')).toBe('more');
    expect(activeTabFromPath('admin', '/(app)/(admin)/more/notifications')).toBe('more');
    expect(activeTabFromPath('admin', '/more/account')).toBe('more');
    // /search redirects to home; path mapping may still treat it as more if visited briefly
    expect(activeTabFromPath('admin', '/search')).toBe('more');
  });

  it('does not map the shared inbox onto More', () => {
    expect(activeTabFromPath('admin', '/notifications')).not.toBe('more');
    expect(activeTabFromPath('admin', '/(app)/notifications')).not.toBe('more');
    expect(activeTabFromPath('customer', '/notifications')).not.toBe('account');
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
    expect(activeTabFromPath('admin', '/(app)/(admin)/ai-intake/job-1')).toBe('orders');
  });

  it('maps dealer schedule and calendar onto Account, not a tab chip', () => {
    expect(activeTabFromPath('customer', '/schedule')).toBe('account');
    expect(activeTabFromPath('customer', '/(app)/(customer)/(tabs)/schedule')).toBe('account');
    expect(activeTabFromPath('customer', '/(app)/(customer)/account/calendar')).toBe('account');
    expect(activeTabFromPath('customer', '/(app)/(customer)/account/notifications')).toBe('account');
  });

  it('maps dealer quotations onto Orders, never Schedule', () => {
    expect(activeTabFromPath('customer', '/quotations')).toBe('orders');
    expect(activeTabFromPath('customer', '/(app)/(customer)/quotations')).toBe('orders');
    expect(activeTabFromPath('customer', '/(app)/(customer)/quotations/q-1')).toBe('orders');
    expect(activeTabFromPath('customer', '/schedule')).toBe('account');
  });

  it('maps employee lane and leftover orders onto tasks', () => {
    expect(activeTabFromPath('employee', '/(app)/(employee)/lane/po-1')).toBe('tasks');
    expect(activeTabFromPath('employee', '/(app)/(employee)/orders/po-1')).toBe('tasks');
    expect(activeTabFromPath('employee', '/(app)/(employee)/tasks/task-1')).toBe('tasks');
    expect(activeTabFromPath('employee', '/(app)/(employee)/tasks/task-1/take-in')).toBe('tasks');
    expect(activeTabFromPath('employee', '/take-in')).toBe('tasks');
  });

  it('maps worker notification settings onto profile, inbox onto notifications', () => {
    expect(activeTabFromPath('employee', '/(app)/(employee)/profile/notifications')).toBe('profile');
    expect(activeTabFromPath('employee', '/(app)/(employee)/(tabs)/notifications')).toBe('notifications');
  });
});
