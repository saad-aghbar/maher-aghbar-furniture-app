import type { HomePersona } from '@maher/permissions';
import type { Tone } from '../../theme/tokens';
import { daysUntil } from '../../lib/format';
import type { useHomeData } from './use-home-data';

export type MetricTile = {
  key: string;
  labelKey: string;
  labelFallback: string;
  value: string | number;
  tone: Tone;
  icon: 'clock' | 'alert' | 'check' | 'money' | 'box' | 'truck' | 'file' | 'users';
  href?: string;
};

type Data = ReturnType<typeof useHomeData>;

const OPEN_TASK_STATUSES = new Set(['NOT_STARTED', 'READY', 'IN_PROGRESS', 'PAUSED', 'BLOCKED']);
const UNPAID_INVOICE_STATUSES = new Set(['ISSUED', 'PARTIALLY_PAID', 'OVERDUE']);
const ACTIVE_DELIVERY_STATUSES = new Set([
  'PLANNED',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'RESCHEDULED',
]);

/**
 * Builds the KPI tiles for a persona from whatever data the user may read.
 * Tiles are derived client-side so every role gets numbers that mean something
 * to them, not a generic corporate dashboard.
 */
export function buildMetrics(persona: HomePersona, data: Data): MetricTile[] {
  const tiles: MetricTile[] = [];
  const report = data.report.data;

  const myTasks = data.tasks.rows.filter((t) => OPEN_TASK_STATUSES.has(t.status));
  const blockedTasks = data.tasks.rows.filter(
    (t) => t.status === 'BLOCKED' || (t.blockers ?? []).some((b) => !b.resolvedAt),
  );
  const dueTasks = myTasks.filter((t) => {
    const d = daysUntil(t.plannedCompletion);
    return d != null && d <= 1;
  });

  const activeDeliveries = data.deliveries.rows.filter((d) =>
    ACTIVE_DELIVERY_STATUSES.has(d.status),
  );
  const todayDeliveries = activeDeliveries.filter((d) => daysUntil(d.scheduledDate) === 0);

  const unpaidInvoices = data.invoices.rows.filter((i) => UNPAID_INVOICE_STATUSES.has(i.status));
  const overdueInvoices = data.invoices.rows.filter(
    (i) => i.status === 'OVERDUE' || (i.status !== 'PAID' && (daysUntil(i.dueDate) ?? 1) < 0),
  );

  const openQuotes = data.quotations.rows.filter((q) =>
    ['SENT', 'VIEWED', 'PENDING_APPROVAL', 'INTERNAL_REVIEW', 'DRAFT'].includes(q.status),
  );
  const quotesAwaitingApproval = data.quotations.rows.filter((q) =>
    ['PENDING_APPROVAL', 'INTERNAL_REVIEW'].includes(q.status),
  );

  const openRequests = data.requests.rows.filter(
    (r) => !['CLOSED', 'QUOTED', 'CANCELLED'].includes(r.status),
  );

  const ordersInProduction = data.salesOrders.rows.filter((o) =>
    ['CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_PRODUCTION', 'READY_FOR_DELIVERY'].includes(o.status),
  );

  const pendingInspections = data.inspections.rows.filter((i) =>
    ['PENDING', 'READY_FOR_INSPECTION', 'IN_PROGRESS'].includes(i.status),
  );
  const failedInspections = data.inspections.rows.filter(
    (i) => i.result === 'FAILED_REWORK_REQUIRED',
  );

  const pendingPurchaseOrders = data.purchaseOrders.rows.filter((p) =>
    ['DRAFT', 'PENDING_APPROVAL', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(p.status),
  );

  switch (persona) {
    case 'production_worker':
      tiles.push(
        m('openTasks', 'Open tasks', myTasks.length, 'brand', 'clock', '/tasks'),
        m('dueToday', 'Due today', dueTasks.length, dueTasks.length ? 'warning' : 'neutral', 'alert', '/tasks'),
        m('blocked', 'Blocked', blockedTasks.length, blockedTasks.length ? 'error' : 'neutral', 'alert', '/tasks'),
        m(
          'inProgress',
          'In progress',
          data.tasks.rows.filter((t) => t.status === 'IN_PROGRESS').length,
          'info',
          'check',
          '/tasks',
        ),
      );
      break;

    case 'production_supervisor':
      tiles.push(
        m('activeOrders', 'Active orders', report?.activeOrders ?? ordersInProduction.length, 'brand', 'box', '/production'),
        m('delayed', 'Delayed', report?.delayedProduction ?? 0, report?.delayedProduction ? 'error' : 'neutral', 'alert', '/production'),
        m('waitingMaterials', 'Waiting materials', report?.waitingMaterials ?? 0, 'warning', 'clock', '/production'),
        m('blockers', 'Critical blockers', report?.criticalBlockers ?? blockedTasks.length, 'error', 'alert', '/tasks'),
      );
      break;

    case 'quality':
      tiles.push(
        m('pendingInspections', 'Pending inspections', pendingInspections.length, 'brand', 'check', '/quality'),
        m('reworkRequired', 'Rework required', failedInspections.length, failedInspections.length ? 'error' : 'neutral', 'alert', '/quality'),
        m('totalInspections', 'Total inspections', data.inspections.meta?.totalItems ?? data.inspections.rows.length, 'info', 'file', '/quality'),
      );
      break;

    case 'delivery':
      tiles.push(
        m('deliveriesToday', 'Scheduled today', todayDeliveries.length, 'brand', 'truck', '/deliveries'),
        m('activeDeliveries', 'Active', activeDeliveries.length, 'info', 'truck', '/deliveries'),
        m(
          'outForDelivery',
          'Out for delivery',
          data.deliveries.rows.filter((d) => d.status === 'OUT_FOR_DELIVERY').length,
          'warning',
          'clock',
          '/deliveries',
        ),
      );
      break;

    case 'warehouse':
      tiles.push(
        m('lowStock', 'Low stock items', data.lowStock.rows.length, data.lowStock.rows.length ? 'warning' : 'success', 'box', '/inventory'),
        m('waitingMaterials', 'Waiting materials', report?.waitingMaterials ?? 0, 'info', 'clock'),
        m('openPurchases', 'Open purchases', report?.openPurchases ?? pendingPurchaseOrders.length, 'brand', 'file', '/purchasing'),
      );
      break;

    case 'purchasing':
      tiles.push(
        m('openPurchaseOrders', 'Open purchase orders', pendingPurchaseOrders.length, 'brand', 'file', '/purchasing'),
        m(
          'awaitingApproval',
          'Awaiting approval',
          data.purchaseOrders.rows.filter((p) => p.status === 'PENDING_APPROVAL').length,
          'warning',
          'clock',
          '/purchasing',
        ),
        m('lowStock', 'Low stock items', data.lowStock.rows.length, 'warning', 'box', '/inventory'),
      );
      break;

    case 'sales':
      tiles.push(
        m('openRequests', 'Open requests', openRequests.length, 'brand', 'file', '/requests'),
        m('openQuotes', 'Open quotations', openQuotes.length, 'info', 'file', '/quotations'),
        m('awaitingApproval', 'Awaiting approval', report?.pendingQuoteApprovals ?? quotesAwaitingApproval.length, 'warning', 'clock', '/quotations'),
        m('ordersInProduction', 'Orders in production', ordersInProduction.length, 'success', 'box', '/sales-orders'),
      );
      break;

    case 'accounting':
      tiles.push(
        m('outstandingInvoices', 'Outstanding invoices', report?.outstandingInvoices ?? unpaidInvoices.length, 'brand', 'money', '/invoices'),
        m('overdue', 'Overdue', overdueInvoices.length, overdueInvoices.length ? 'error' : 'success', 'alert', '/invoices'),
        m('receivables', 'Receivables', money(report?.receivablesAmount), 'warning', 'money', '/invoices'),
        m('revenueInvoiced', 'Invoiced', money(report?.revenueInvoiced), 'success', 'money', '/reports'),
      );
      break;

    case 'customer':
      tiles.push(
        m('openRequests', 'My requests', openRequests.length, 'brand', 'file', '/requests'),
        m('openQuotes', 'Quotations to review', openQuotes.length, openQuotes.length ? 'warning' : 'neutral', 'file', '/quotations'),
        m('ordersInProduction', 'Orders in progress', ordersInProduction.length, 'info', 'box', '/sales-orders'),
        m('outstandingInvoices', 'Unpaid invoices', unpaidInvoices.length, unpaidInvoices.length ? 'error' : 'success', 'money', '/invoices'),
      );
      break;

    case 'management':
    case 'admin':
      tiles.push(
        m('activeOrders', 'Active orders', report?.activeOrders ?? 0, 'brand', 'box', '/production'),
        m('dueSoon', 'Due soon', report?.ordersDueSoon ?? 0, 'warning', 'clock', '/production'),
        m('delayed', 'Delayed production', report?.delayedProduction ?? 0, report?.delayedProduction ? 'error' : 'success', 'alert', '/production'),
        m('awaitingApproval', 'Quotes awaiting approval', report?.pendingQuoteApprovals ?? 0, 'info', 'file', '/quotations'),
        m('receivables', 'Receivables', money(report?.receivablesAmount), 'warning', 'money', '/invoices'),
        m('revenueInvoiced', 'Invoiced', money(report?.revenueInvoiced), 'success', 'money', '/reports'),
      );
      break;

    default:
      break;
  }

  return tiles.filter((tile) => tile.value !== '' && tile.value != null);
}

function m(
  key: string,
  fallback: string,
  value: string | number,
  tone: Tone,
  icon: MetricTile['icon'],
  href?: string,
): MetricTile {
  return { key, labelKey: `mobile.${key}`, labelFallback: fallback, value, tone, icon, href };
}

/** Compact money for tiles — thousands become "12.4k" so the tile never wraps. */
function money(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}
