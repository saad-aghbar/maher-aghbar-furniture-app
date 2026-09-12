/** Shared Cost & Performance query-string helpers. */

export type ReportsFilter = {
  from: string;
  to: string;
  customerId: string;
  productId: string;
  variantId: string;
  optionValueId: string;
  salesRepId: string;
  status: string;
  page: string;
};

export const EMPTY_REPORTS_FILTER: ReportsFilter = {
  from: '',
  to: '',
  customerId: '',
  productId: '',
  variantId: '',
  optionValueId: '',
  salesRepId: '',
  status: '',
  page: '',
};

export function buildQuery(params: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value.trim()) qs.set(key, value.trim());
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcTodayBounds(): { from: string; to: string } {
  const now = new Date();
  const ymd = utcYmd(now);
  return { from: ymd, to: ymd };
}

export function utcThisWeekBounds(): { from: string; to: string } {
  const now = new Date();
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
  return { from: utcYmd(monday), to: utcYmd(sunday) };
}

export function utcThisMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: utcYmd(from), to: utcYmd(to) };
}

export type DatePreset = 'today' | 'week' | 'month' | 'custom';

export function detectPreset(from: string, to: string): DatePreset {
  if (!from && !to) return 'custom';
  const today = utcTodayBounds();
  if (from === today.from && to === today.to) return 'today';
  const week = utcThisWeekBounds();
  if (from === week.from && to === week.to) return 'week';
  const month = utcThisMonthBounds();
  if (from === month.from && to === month.to) return 'month';
  return 'custom';
}

export function filterFromSearchParams(sp: URLSearchParams): ReportsFilter {
  return {
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    customerId: sp.get('customerId') ?? '',
    productId: sp.get('productId') ?? '',
    variantId: sp.get('variantId') ?? '',
    optionValueId: sp.get('optionValueId') ?? '',
    salesRepId: sp.get('salesRepId') ?? '',
    status: sp.get('status') ?? '',
    page: sp.get('page') ?? '',
  };
}

export function filterQueryString(filter: ReportsFilter) {
  return buildQuery({
    from: filter.from,
    to: filter.to,
    customerId: filter.customerId,
    productId: filter.productId,
    variantId: filter.variantId,
    optionValueId: filter.optionValueId,
    salesRepId: filter.salesRepId,
    status: filter.status,
    page: filter.page,
  });
}

export const REPORTS_SECTIONS = [
  { href: '/reports', key: 'sectionMoney' },
  { href: '/reports/orders', key: 'lensOrders' },
  { href: '/reports/products', key: 'sectionProducts' },
  { href: '/reports/returns', key: 'lensReturns' },
  { href: '/reports/coverage', key: 'coverage' },
] as const;
