import { formatDateRange } from '@/i18n/format';
import {
  reportsDateRangeParts,
  reportsPeriodRange,
  selectDashboardSnapshot,
  selectStatusRows,
} from '../selectReports';

describe('selectReports', () => {
  it('uses month-to-date (1st through today), not month-end', () => {
    const range = reportsPeriodRange('month', new Date(2026, 7, 30));
    expect(range).toEqual({ from: '2026-08-01', to: '2026-08-30' });
  });

  it('uses week-to-date from Sunday through today', () => {
    const sunday = reportsPeriodRange('week', new Date(2026, 7, 30));
    expect(sunday).toEqual({ from: '2026-08-30', to: '2026-08-30' });
    const wednesday = reportsPeriodRange('week', new Date(2026, 7, 12));
    expect(wednesday).toEqual({ from: '2026-08-09', to: '2026-08-12' });
  });

  it('formats the live range without ISO or ASCII arrows', () => {
    const range = reportsPeriodRange('month', new Date(2026, 7, 30));
    const label = formatDateRange('en', range.from, range.to);
    const parts = reportsDateRangeParts('en', range);
    expect(label).toBe(formatDateRange('en', '2026-08-01', '2026-08-30'));
    expect(label).toMatch(/1 Aug 2026/);
    expect(label).toMatch(/30 Aug 2026/);
    expect(label).toContain('\u2013');
    expect(label).not.toContain('->');
    expect(label).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(parts.start).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(parts.end).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(`${parts.start} ${parts.dash} ${parts.end}`).not.toContain('->');
  });

  it('keeps missing dashboard revenue as ₪0.00 (do not invent)', () => {
    const metrics = selectDashboardSnapshot('en', {
      ordersInProduction: 79,
      ordersNearingDelivery: 11,
      delayedOrders: 8,
      openInvoices: 24,
      outstandingReceivables: 43577.83,
      lowStockItems: 24,
    });
    const revenue = metrics.find((m) => m.key === 'revenue');
    expect(revenue?.value).toMatch(/0\.00/);
    expect(revenue?.value).toMatch(/₪|ILS/);
    const purchases = metrics.find((m) => m.key === 'openPurchases');
    expect(purchases?.value).toMatch(/0/);
  });

  it('normalizes mixed status count shapes', () => {
    expect(
      selectStatusRows([
        { status: 'IN_PRODUCTION', count: 3, total: 10 },
        { status: 'COMPLETED', _count: 2 },
      ]),
    ).toEqual([
      { status: 'IN_PRODUCTION', count: 3, total: 10 },
      { status: 'COMPLETED', count: 2, total: undefined },
    ]);
  });
});
