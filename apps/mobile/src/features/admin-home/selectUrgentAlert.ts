import type { AdminHomePayload } from './api';

export type UrgentAlertKind = 'late' | 'urgentTasks' | 'lowStock' | 'pendingReturns';

export type UrgentAlert = {
  kind: UrgentAlertKind;
  count: number;
};

/** Single prominent alert — first matching signal wins. */
export function selectUrgentAlert(data: AdminHomePayload | null | undefined): UrgentAlert | null {
  if (!data) return null;
  if (data.delayedOrders > 0) return { kind: 'late', count: data.delayedOrders };
  if (data.urgentTasksCount > 0) return { kind: 'urgentTasks', count: data.urgentTasksCount };
  if (data.lowStockItems > 0) return { kind: 'lowStock', count: data.lowStockItems };
  if (data.pendingReturns > 0) return { kind: 'pendingReturns', count: data.pendingReturns };
  return null;
}

export type MetricKey =
  | 'newOrders'
  | 'ordersInProduction'
  | 'ordersNearingDelivery'
  | 'delayedOrders'
  | 'completedToday'
  | 'lowStockItems'
  | 'outstandingReceivables';

export type MetricDef = {
  key: MetricKey;
  /** Numeric value to display (money coerced to number). */
  value: number;
  isMoney?: boolean;
  /** Emphasize late / warning tiles on Screen 03. */
  emphasize?: 'warning' | 'error';
  href:
    | '/(app)/(admin)/(tabs)/orders'
    | '/(app)/(admin)/(tabs)/inventory'
    | '/(app)/(admin)/(tabs)/production'
    | null;
};

/** Screen 03 hero KPIs — 2×2. */
export function primaryKpis(data: AdminHomePayload): MetricDef[] {
  return [
    {
      key: 'newOrders',
      value: data.newOrders,
      href: '/(app)/(admin)/(tabs)/orders',
    },
    {
      key: 'ordersInProduction',
      value: data.ordersInProduction,
      href: '/(app)/(admin)/(tabs)/production',
    },
    {
      key: 'ordersNearingDelivery',
      value: data.ordersNearingDelivery,
      href: '/(app)/(admin)/(tabs)/orders',
    },
    {
      key: 'delayedOrders',
      value: data.delayedOrders,
      emphasize: data.delayedOrders > 0 ? 'warning' : undefined,
      href: '/(app)/(admin)/(tabs)/orders',
    },
  ];
}

/** Secondary 1×2 strip — low stock + receivables. */
export function secondaryKpis(data: AdminHomePayload): MetricDef[] {
  const money = Number(data.outstandingReceivables);
  return [
    {
      key: 'lowStockItems',
      value: data.lowStockItems,
      emphasize: data.lowStockItems > 0 ? 'warning' : undefined,
      href: '/(app)/(admin)/(tabs)/inventory',
    },
    {
      key: 'outstandingReceivables',
      value: Number.isFinite(money) ? money : 0,
      isMoney: true,
      href: null,
    },
  ];
}

/** @deprecated Prefer primaryKpis + secondaryKpis; kept for combined empty checks. */
export function visibleMetrics(data: AdminHomePayload): MetricDef[] {
  return [...primaryKpis(data), ...secondaryKpis(data)];
}

/** True when the home has no operational signal to show. */
export function isAdminHomeEmpty(data: AdminHomePayload): boolean {
  return (
    visibleMetrics(data).every((m) => m.value === 0) &&
    !selectUrgentAlert(data) &&
    data.recentOrders.length === 0
  );
}
