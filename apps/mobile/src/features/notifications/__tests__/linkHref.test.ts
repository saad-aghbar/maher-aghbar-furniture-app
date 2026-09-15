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
    expect(mapNotificationLinkToHref('/quotations/q-1', 'customer')).toBe(
      '/(app)/(customer)/quotations/q-1',
    );
  });

  it('never sends customer surface to admin paths', () => {
    const href = String(mapNotificationLinkToHref('/sales-orders/x', 'customer'));
    expect(href.includes('(admin)')).toBe(false);
    expect(String(mapNotificationLinkToHref('/ai-intake/1', 'customer')).includes('(admin)')).toBe(
      false,
    );
    expect(String(mapNotificationLinkToHref('/tasks/1', 'customer')).includes('(admin)')).toBe(
      false,
    );
  });

  it('keeps admin surface on admin routes', () => {
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'admin')).toBe(
      '/(app)/(admin)/orders/abc',
    );
    expect(mapNotificationLinkToHref('/invoices/inv-1', 'admin')).toBe(
      '/(app)/(admin)/invoices/inv-1',
    );
    expect(mapNotificationLinkToHref('/requests/rfq-1', 'admin')).toBe(
      '/(app)/(admin)/requests/rfq-1',
    );
    expect(mapNotificationLinkToHref('/production/po-1', 'admin')).toBe(
      '/(app)/(admin)/production/po-1',
    );
    expect(mapNotificationLinkToHref('/deliveries/d-1', 'admin')).toBe(
      '/(app)/(admin)/deliveries/d-1',
    );
  });

  it('routes employee tasks and never into admin', () => {
    expect(mapNotificationLinkToHref('/tasks/t1', 'employee', 'task.ready')).toBe(
      '/(app)/(employee)/tasks/t1',
    );
    expect(mapNotificationLinkToHref('/tasks/t1', 'employee', 'quality.queued')).toBe(
      '/(app)/(employee)/tasks/t1',
    );
    expect(mapNotificationLinkToHref('/tasks/t-pack', 'employee', 'packaging.ready')).toBe(
      '/(app)/(employee)/tasks/t-pack',
    );
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'customer', 'order.readyForDelivery')).toBe(
      '/(app)/(customer)/orders/abc',
    );
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'employee', 'order.onHold')).toBe(
      '/(app)/(employee)/orders/abc',
    );
    expect(String(mapNotificationLinkToHref('/tasks/t1', 'employee', 'quality.failed')).includes('(admin)')).toBe(
      false,
    );
    expect(String(mapNotificationLinkToHref('/sales-orders/abc', 'employee')).includes('(admin)')).toBe(
      false,
    );
  });

  it('opens admin order detail from topic + entityId when linkUrl is missing', () => {
    expect(
      mapNotificationLinkToHref(null, 'admin', 'order.confirmed', {
        entityType: 'salesOrder',
        entityId: 'so-99',
      }),
    ).toBe('/(app)/(admin)/orders/so-99');
  });

  it('does not fall back to the admin home hub when an entity id is present', () => {
    const href = String(
      mapNotificationLinkToHref(null, 'admin', 'order.confirmed', {
        entityType: 'salesOrder',
        entityId: 'so-99',
      }),
    );
    expect(href).not.toBe('/(app)/(admin)/(tabs)');
    expect(href).toBe('/(app)/(admin)/orders/so-99');
  });
});
