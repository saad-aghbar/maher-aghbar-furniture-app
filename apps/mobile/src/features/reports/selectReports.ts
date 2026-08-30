import type { Locale } from '@maher/types';
import { parseYmd, todayYmd, toYmd } from '@/components/calendar/calendarMath';
import { dateRangeParts, formatCurrency, formatNumber } from '@/i18n/format';

export type ReportsPeriod = 'today' | 'week' | 'month';
export type ReportsCategory = 'dashboard' | 'sales' | 'production' | 'financial';

export type ReportsDateRange = { from: string; to: string };

export type DashboardSnapshotMetric = {
  key: string;
  labelKey: string;
  value: string;
  money: boolean;
};

export type StatusCountRow = {
  status: string;
  count: number;
  total?: number;
};

/** Sunday week-start, same factory calendar as scheduling. */
function weekStartYmd(ymd: string): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return ymd;
  const dt = new Date(parsed.y, parsed.m, parsed.d);
  dt.setDate(dt.getDate() - dt.getDay());
  return toYmd(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/**
 * Period-to-date windows. This month is the 1st through today (not month-end).
 */
export function reportsPeriodRange(
  period: ReportsPeriod,
  now: Date = new Date(),
): ReportsDateRange {
  const to = todayYmd(now);
  if (period === 'today') return { from: to, to };
  if (period === 'week') return { from: weekStartYmd(to), to };
  const parsed = parseYmd(to);
  if (!parsed) return { from: to, to };
  return { from: toYmd(parsed.y, parsed.m, 1), to };
}

export function reportsDateRangeParts(
  locale: Locale,
  range: ReportsDateRange,
): { start: string; dash: string; end: string } {
  return dateRangeParts(locale, range.from, range.to);
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type DashboardReport = {
  activeOrders?: number;
  ordersInProduction?: number;
  ordersDueSoon?: number;
  ordersNearingDelivery?: number;
  delayedProduction?: number;
  delayedOrders?: number;
  outstandingInvoices?: number;
  openInvoices?: number;
  revenueInvoiced?: number | string | null;
  receivablesAmount?: number | string | null;
  outstandingReceivables?: number | string | null;
  lowStock?: number;
  lowStockItems?: number;
  openPurchases?: number;
};

export function selectDashboardSnapshot(
  locale: Locale,
  dash: DashboardReport | undefined | null,
): DashboardSnapshotMetric[] {
  const revenue = asNumber(dash?.revenueInvoiced);
  const receivables = asNumber(dash?.outstandingReceivables ?? dash?.receivablesAmount);
  return [
    {
      key: 'activeOrders',
      labelKey: 'common.metricActiveOrders',
      value: formatNumber(locale, asNumber(dash?.ordersInProduction ?? dash?.activeOrders), {
        maximumFractionDigits: 0,
      }),
      money: false,
    },
    {
      key: 'dueSoon',
      labelKey: 'common.metricOrdersDueSoon',
      value: formatNumber(locale, asNumber(dash?.ordersNearingDelivery ?? dash?.ordersDueSoon), {
        maximumFractionDigits: 0,
      }),
      money: false,
    },
    {
      key: 'delayed',
      labelKey: 'common.metricDelayedProduction',
      value: formatNumber(locale, asNumber(dash?.delayedOrders ?? dash?.delayedProduction), {
        maximumFractionDigits: 0,
      }),
      money: false,
    },
    {
      key: 'outstandingInvoices',
      labelKey: 'common.metricOutstandingInvoices',
      value: formatNumber(locale, asNumber(dash?.openInvoices ?? dash?.outstandingInvoices), {
        maximumFractionDigits: 0,
      }),
      money: false,
    },
    {
      key: 'revenue',
      labelKey: 'common.metricRevenueInvoiced',
      value: formatCurrency(locale, revenue),
      money: true,
    },
    {
      key: 'receivables',
      labelKey: 'common.metricReceivables',
      value: formatCurrency(locale, receivables),
      money: true,
    },
    {
      key: 'lowStock',
      labelKey: 'common.metricLowStock',
      value: formatNumber(locale, asNumber(dash?.lowStockItems ?? dash?.lowStock), {
        maximumFractionDigits: 0,
      }),
      money: false,
    },
    {
      key: 'openPurchases',
      labelKey: 'common.metricOpenPurchases',
      value: formatNumber(locale, asNumber(dash?.openPurchases), { maximumFractionDigits: 0 }),
      money: false,
    },
  ];
}

export function statusCount(row: {
  status?: string;
  count?: unknown;
  _count?: number | { _all?: number } | null;
}): number {
  if (typeof row.count === 'number') return row.count;
  if (typeof row._count === 'number') return row._count;
  if (row._count && typeof row._count === 'object') {
    return asNumber(row._count._all);
  }
  return 0;
}

export function selectStatusRows(
  rows: Array<{
    status?: string;
    count?: unknown;
    _count?: number | { _all?: number } | null;
    total?: unknown;
  }> | null | undefined,
): StatusCountRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    status: row.status ?? 'unknown',
    count: statusCount(row),
    total: row.total == null ? undefined : asNumber(row.total),
  }));
}
