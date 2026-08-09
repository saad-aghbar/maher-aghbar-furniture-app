import type { DealerHomePayload } from './api';

export type MetricKey = 'activeOrders' | 'ordersInProduction' | 'ordersNearingDelivery';

export type MetricDef = {
  key: MetricKey;
  value: number;
};

export function metricStrip(data: DealerHomePayload): MetricDef[] {
  return [
    { key: 'activeOrders', value: data.activeOrders },
    { key: 'ordersInProduction', value: data.ordersInProduction },
    { key: 'ordersNearingDelivery', value: data.ordersNearingDelivery },
  ];
}

export function isDealerHomeEmpty(data: DealerHomePayload): boolean {
  return (
    data.activeOrders === 0 &&
    data.completedOrders === 0 &&
    data.recentOrders.length === 0 &&
    Number(data.outstandingBalance) === 0 &&
    data.recentInvoices.length === 0
  );
}

export function outstandingBalanceNumber(data: DealerHomePayload): number {
  const n = Number(data.outstandingBalance);
  return Number.isFinite(n) ? n : 0;
}
