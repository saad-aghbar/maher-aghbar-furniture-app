/**
 * Canonical sales-order statuses — must match Prisma `SalesOrderStatus`.
 *
 * `COMPLETED` is a legacy synonym of `DELIVERED`. Runtime writes only `DELIVERED`
 * when the dealer confirms receipt. Keep `COMPLETED` in the enum so existing
 * rows and seeds still classify as delivered.
 */
export const SALES_ORDER_STATUSES = [
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
] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const DELIVERED_SALES_ORDER_STATUSES = ['DELIVERED', 'COMPLETED'] as const;

export function isDeliveredSalesOrderStatus(
  status: string | null | undefined,
): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === 'DELIVERED' || s === 'COMPLETED';
}
