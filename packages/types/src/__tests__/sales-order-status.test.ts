import {
  DELIVERED_SALES_ORDER_STATUSES,
  SALES_ORDER_STATUSES,
  isDeliveredSalesOrderStatus,
} from '../sales-order-status';

describe('sales-order-status', () => {
  it('matches the Prisma sales-order enum (no INVOICED/CLOSED)', () => {
    expect(SALES_ORDER_STATUSES).toEqual([
      'DRAFT',
      'CONFIRMED',
      'WAITING_FOR_PAYMENT',
      'WAITING_FOR_MATERIALS',
      'READY_FOR_PRODUCTION',
      'IN_PRODUCTION',
      'READY_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'ON_HOLD',
    ]);
    expect(SALES_ORDER_STATUSES).not.toContain('INVOICED');
    expect(SALES_ORDER_STATUSES).not.toContain('CLOSED');
  });

  it('treats COMPLETED as delivered without changing DELIVERED', () => {
    expect(isDeliveredSalesOrderStatus('DELIVERED')).toBe(true);
    expect(isDeliveredSalesOrderStatus('COMPLETED')).toBe(true);
    expect(isDeliveredSalesOrderStatus('IN_PRODUCTION')).toBe(false);
    expect(isDeliveredSalesOrderStatus('CANCELLED')).toBe(false);
    expect(DELIVERED_SALES_ORDER_STATUSES).toEqual(['DELIVERED', 'COMPLETED']);
  });
});
