import type { SalesOrderListItem } from '@/api/modules/sales-orders';

const WAITING = new Set([
  'DRAFT',
  'CONFIRMED',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
]);
const IN_PRODUCTION = new Set(['IN_PRODUCTION']);
const DONE = new Set(['READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED']);
const ACTIVE_PRODUCTION_PO = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
]);

export function isInProductionOrder(o: SalesOrderListItem): boolean {
  if (DONE.has(o.status)) return false;
  if (IN_PRODUCTION.has(o.status)) return true;
  if (o.progressPercent != null && o.progressPercent > 0) return true;
  return (o.productionOrders ?? []).some(
    (po) => po.status != null && ACTIVE_PRODUCTION_PO.has(po.status),
  );
}

export function filterWaitingOrders(orders: SalesOrderListItem[]) {
  return orders.filter((o) => WAITING.has(o.status) && !isInProductionOrder(o));
}

export function filterProductionOrders(orders: SalesOrderListItem[]) {
  return orders.filter((o) => isInProductionOrder(o));
}

export function filterCompletedOrders(orders: SalesOrderListItem[]) {
  return orders.filter((o) => DONE.has(o.status));
}

export function dealerTypeLabel(
  type: string | undefined,
  t: (key: string) => string,
): string {
  switch (type) {
    case 'INDIVIDUAL':
      return t('customers.individual');
    case 'SHOWROOM':
      return t('customers.showroom');
    case 'COMPANY':
    default:
      return t('customers.company');
  }
}
