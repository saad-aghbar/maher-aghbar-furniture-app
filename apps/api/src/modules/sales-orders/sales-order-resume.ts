import { SalesOrderStatus } from '@maher/database';

/** Canonical resume target after ON_HOLD, from sibling production-order statuses. */
export function inferSalesOrderResumeStatus(poStatuses: string[]): SalesOrderStatus {
  const open = poStatuses.filter((status) => status !== 'CANCELLED');
  if (!open.length) return SalesOrderStatus.CONFIRMED;
  if (
    open.some((status) => status === 'READY_FOR_DELIVERY') &&
    open.every((status) => ['COMPLETED', 'READY_FOR_DELIVERY'].includes(status))
  ) {
    return SalesOrderStatus.READY_FOR_DELIVERY;
  }
  if (
    open.some((status) =>
      ['IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_PACKAGING', 'ON_HOLD'].includes(status),
    )
  ) {
    return SalesOrderStatus.IN_PRODUCTION;
  }
  if (open.some((status) => status === 'WAITING_FOR_MATERIALS')) {
    return SalesOrderStatus.WAITING_FOR_MATERIALS;
  }
  return SalesOrderStatus.READY_FOR_PRODUCTION;
}
