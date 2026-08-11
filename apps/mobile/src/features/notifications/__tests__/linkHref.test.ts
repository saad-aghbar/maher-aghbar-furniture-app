import { mapNotificationLinkToHref } from '../linkHref';

describe('mapNotificationLinkToHref', () => {
  it('routes customer surface to customer orders/invoices/returns', () => {
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'customer')).toBe(
      '/(app)/(customer)/orders/abc',
    );
    expect(mapNotificationLinkToHref('/invoices/inv-1', 'customer')).toBe(
      '/(app)/(customer)/invoices/inv-1',
    );
    expect(mapNotificationLinkToHref('/returns/ret-1', 'customer')).toBe(
      '/(app)/(customer)/returns/ret-1',
    );
    expect(mapNotificationLinkToHref('/account/statement', 'customer')).toBe(
      '/(app)/(customer)/account/statement',
    );
  });

  it('never sends customer surface to admin paths', () => {
    const href = String(mapNotificationLinkToHref('/sales-orders/x', 'customer'));
    expect(href.includes('(admin)')).toBe(false);
    expect(mapNotificationLinkToHref('/ai-intake/1', 'customer')).toBeNull();
    expect(mapNotificationLinkToHref('/tasks/1', 'customer')).toBeNull();
  });

  it('keeps admin surface on admin routes', () => {
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'admin')).toBe(
      '/(app)/(admin)/orders/abc',
    );
    expect(mapNotificationLinkToHref('/invoices/inv-1', 'admin')).toBe(
      '/(app)/(admin)/invoices/inv-1',
    );
  });

  it('routes employee tasks', () => {
    expect(mapNotificationLinkToHref('/tasks/t1', 'employee')).toBe(
      '/(app)/(employee)/tasks/t1',
    );
  });
});
