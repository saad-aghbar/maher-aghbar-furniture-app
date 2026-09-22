'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import type { AuthUser } from '@maher/types';
import {
  Board,
  ErrorState,
  Figure,
  Ledger,
  LedgerRow,
  Ltr,
  Ribbon,
  Skeleton,
  Stamp,
  StatusBadge,
  type BoardTone,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Armchair,
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Factory,
  Package,
  PackageCheck,
  Receipt,
  Scroll,
  ShoppingBag,
  SquarePen,
  Truck,
  Undo2,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

interface Paginated<T> {
  data: T[];
  meta?: { totalItems?: number };
}

interface RequestRow {
  id: string;
  number: string;
  status: string;
  title?: string | null;
  imageUrl?: string | null;
  externalOrderNumber?: string | null;
  endCustomerName?: string | null;
  createdAt?: string;
  items?: Array<{ productName?: string | null }>;
}

interface SalesOrderRow {
  id: string;
  number: string;
  status: string;
  title?: string | null;
  imageUrl?: string | null;
  externalOrderNumber?: string | null;
  progressPercent?: number | null;
  requiredDeliveryDate?: string | null;
  quotation?: {
    request?: { externalOrderNumber?: string | null; endCustomerName?: string | null } | null;
  } | null;
  productionOrders?: Array<{ progressPercent?: number | null; status?: string }>;
}

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  outstandingAmount?: string | number;
}

interface CatalogProduct {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string;
  nameHe?: string;
  imageUrl?: string | null;
  dealerPrice?: string | number | null;
  basePrice?: string | number | null;
  price?: string | number | null;
}

type HubItem = (RequestRow & { kind: 'rfq' }) | (SalesOrderRow & { kind: 'sales_order' });

const DONE_SO = new Set(['DELIVERED', 'COMPLETED', 'CLOSED']);
const IN_PRODUCTION_SO = new Set(['IN_PRODUCTION', 'READY_FOR_DELIVERY']);

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function money(value: number | undefined, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  // Always Western separators (1,112.93) — Arabic UI must not drop ,/.
  return `${n.toLocaleString('en-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function orderTitle(row: HubItem) {
  if (row.kind === 'sales_order') return row.title?.trim() || row.number;
  return row.title?.trim() || row.items?.[0]?.productName?.trim() || row.number;
}

function dealerNo(row: HubItem) {
  if (row.kind === 'rfq') return row.externalOrderNumber?.trim() || null;
  return (
    row.externalOrderNumber?.trim() ||
    row.quotation?.request?.externalOrderNumber?.trim() ||
    null
  );
}

function endCustomer(row: HubItem) {
  if (row.kind === 'rfq') return row.endCustomerName?.trim() || null;
  return row.quotation?.request?.endCustomerName?.trim() || null;
}

function progressOf(row: SalesOrderRow) {
  if (row.progressPercent != null) return Math.min(100, Math.max(0, Number(row.progressPercent)));
  const fromPo = (row.productionOrders ?? []).reduce(
    (m, po) => Math.max(m, Number(po.progressPercent ?? 0)),
    0,
  );
  return Math.min(100, fromPo);
}

export default function CustomerDashboard() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const currency = tCommon('currency');

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
    staleTime: 5 * 60 * 1000,
  });

  const requests = useQuery({
    queryKey: ['dealer-dash-requests'],
    queryFn: () =>
      apiFetch<Paginated<RequestRow>>('/api/v1/requests?page=1&pageSize=12').catch(() => ({
        data: [] as RequestRow[],
        meta: { totalItems: 0 },
      })),
  });

  const salesOrders = useQuery({
    queryKey: ['dealer-dash-sales-orders'],
    queryFn: () =>
      apiFetch<Paginated<SalesOrderRow>>('/api/v1/sales-orders?page=1&pageSize=12').catch(() => ({
        data: [] as SalesOrderRow[],
        meta: { totalItems: 0 },
      })),
  });

  const ownDeliveries = useQuery({
    queryKey: ['customer-own-deliveries'],
    queryFn: () =>
      apiFetch<{
        summary?: { thisWeek?: number; mayBeDelayed?: number };
        data?: Array<{ salesOrderId: string; calendarDate?: string | null }>;
      }>('/api/v1/scheduling/own-deliveries').catch(() => ({
        summary: { thisWeek: 0, mayBeDelayed: 0 },
        data: [],
      })),
  });

  const invoices = useQuery({
    queryKey: ['dealer-dash-invoices'],
    queryFn: async () => {
      const json = await apiFetch<Paginated<InvoiceRow> | InvoiceRow[]>(
        '/api/v1/invoices?page=1&pageSize=50',
      ).catch(() => ({ data: [] as InvoiceRow[], meta: { totalItems: 0 } }));
      return Array.isArray(json) ? { data: json, meta: { totalItems: json.length } } : json;
    },
  });

  const returns = useQuery({
    queryKey: ['dealer-dash-returns'],
    queryFn: () =>
      apiFetch<Paginated<unknown>>('/api/v1/returns?page=1&pageSize=1').catch(() => ({
        data: [],
        meta: { totalItems: 0 },
      })),
  });

  const catalog = useQuery({
    queryKey: ['dealer-dash-catalog'],
    queryFn: () =>
      apiFetch<{ data: CatalogProduct[] }>('/api/v1/catalog/browse/products?pageSize=8').then(
        (r) => r.data ?? [],
      ),
  });

  const isLoading =
    me.isLoading ||
    (requests.isLoading && salesOrders.isLoading && invoices.isLoading && returns.isLoading);

  const stats = useMemo(() => {
    const rfqs = requests.data?.data ?? [];
    const sos = salesOrders.data?.data ?? [];
    const inv = invoices.data?.data ?? [];

    const rfqOpen = rfqs.filter((r) => !['QUOTED', 'CLOSED', 'CANCELLED'].includes(r.status)).length;
    const inProduction = sos.filter(
      (s) => IN_PRODUCTION_SO.has(s.status) || (s.progressPercent ?? 0) > 0,
    ).length;
    const nearing =
      ownDeliveries.data?.summary?.thisWeek ??
      sos.filter((s) => {
        if (!s.requiredDeliveryDate || DONE_SO.has(s.status) || s.status === 'CANCELLED') return false;
        const d = new Date(s.requiredDeliveryDate).getTime() - Date.now();
        return d >= 0 && d <= 7 * 24 * 60 * 60 * 1000;
      }).length;
    const done = sos.filter((s) => DONE_SO.has(s.status)).length;
    const openInv = inv.filter((i) =>
      ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status),
    );
    const outstanding = openInv.reduce((sum, i) => sum + Number(i.outstandingAmount ?? 0), 0);
    const ordersTotal =
      (requests.data?.meta?.totalItems ?? rfqs.length) +
      (salesOrders.data?.meta?.totalItems ?? sos.length);
    const returnsTotal = returns.data?.meta?.totalItems ?? returns.data?.data?.length ?? 0;

    const hub: HubItem[] = [
      ...sos.map((s) => ({ ...s, kind: 'sales_order' as const })),
      ...rfqs.map((r) => ({ ...r, kind: 'rfq' as const })),
    ]
      .sort((a, b) => {
        const da = a.kind === 'rfq' ? a.createdAt : undefined;
        const db = b.kind === 'rfq' ? b.createdAt : undefined;
        return String(db ?? '').localeCompare(String(da ?? ''));
      })
      .slice(0, 6);

    const tracking = sos.slice(0, 6).map((s) => ({ ...s, kind: 'sales_order' as const }));

    return {
      ordersTotal,
      rfqOpen,
      inProduction,
      nearing,
      done,
      openInvoices: openInv.length,
      outstanding,
      returnsTotal,
      hub: tracking.length ? tracking : hub,
    };
  }, [requests.data, salesOrders.data, invoices.data, returns.data, ownDeliveries.data]);

  const journeyShares = useMemo(() => {
    const parts = [stats.rfqOpen, stats.inProduction, stats.nearing, stats.done] as const;
    const total = parts.reduce((s, n) => s + n, 0);
    if (total <= 0) return { request: 0, production: 0, nearing: 0, done: 0 };
    const rounded = parts.map((n) => Math.round((n / total) * 100));
    const drift = 100 - rounded.reduce((s, n) => s + n, 0);
    if (drift !== 0) {
      let maxIdx = 0;
      for (let i = 1; i < rounded.length; i++) {
        if (rounded[i]! >= rounded[maxIdx]!) maxIdx = i;
      }
      rounded[maxIdx]! += drift;
    }
    return {
      request: rounded[0]!,
      production: rounded[1]!,
      nearing: rounded[2]!,
      done: rounded[3]!,
    };
  }, [stats.rfqOpen, stats.inProduction, stats.nearing, stats.done]);

  const firstName = useMemo(() => {
    const name = me.data?.name?.trim();
    if (!name) return null;
    return name.split(/\s+/)[0] ?? name;
  }, [me.data?.name]);

  const attentionTotal = stats.returnsTotal + stats.openInvoices + stats.nearing;
  const ready = Boolean(requests.isSuccess || salesOrders.isSuccess);
  const updatedAt = new Date(
    Math.max(requests.dataUpdatedAt || Date.now(), salesOrders.dataUpdatedAt || Date.now()),
  ).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-[var(--maher-radius-xl)]" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--maher-radius-xl)]" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-[var(--maher-radius-xl)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-[var(--maher-radius-xl)]" />
          ))}
        </div>
      </div>
    );
  }

  if (me.isError) {
    return (
      <ErrorState
        title={t('dashboard')}
        onRetry={() => void me.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const shortcuts: Array<{ href: string; label: string; icon: LucideIcon }> = [
    { href: '/dealer/catalog', label: t('catalog'), icon: ShoppingBag },
    { href: '/dealer/orders/new', label: t('createOrder'), icon: SquarePen },
    { href: '/dealer/orders', label: t('myOrders'), icon: Package },
    { href: '/dealer/invoices', label: t('invoices'), icon: Receipt },
    { href: '/dealer/statement', label: t('statement'), icon: Scroll },
    { href: '/dealer/returns', label: t('returns'), icon: Undo2 },
    { href: '/dealer/profile', label: t('profile'), icon: User },
  ];

  const products = catalog.data ?? [];

  const journey: Array<{
    key: string;
    href: string;
    label: string;
    value: number;
    share: number;
    tone: BoardTone;
    icon: LucideIcon;
  }> = [
    { key: 'request', href: '/dealer/orders', label: tCommon('dealerStageRequest'), value: stats.rfqOpen, share: journeyShares.request, tone: 'brand', icon: ClipboardList },
    { key: 'production', href: '/dealer/orders', label: tCommon('dealerStageProduction'), value: stats.inProduction, share: journeyShares.production, tone: 'info', icon: Factory },
    { key: 'delivery', href: '/dealer/orders', label: tCommon('dealerStageDelivery'), value: stats.nearing, share: journeyShares.nearing, tone: 'warning', icon: Truck },
    { key: 'done', href: '/dealer/orders', label: tCommon('dealerStageDone'), value: stats.done, share: journeyShares.done, tone: 'success', icon: PackageCheck },
  ];
  const heroTone: BoardTone =
    stats.returnsTotal > 0 ? 'warning' : stats.nearing > 0 ? 'info' : 'brand';

  return (
    <div className="maher-stagger space-y-5 pb-6">
      {/* Hero */}
      <Board tone={heroTone} wash="top" as="section">
        <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            <p className="text-[13px] leading-5 text-[var(--maher-text-secondary)]">
              {tCommon('dashboardUpdated', { time: updatedAt })}
            </p>
            <h1 className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[30px] sm:leading-9">
              {firstName
                ? tCommon('dealerGreetingNamed', { name: firstName })
                : tCommon('dealerGreeting')}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--maher-text-secondary)]">
              {tCommon('dealerDashboardSubtitle')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dealer/orders/new"
                className="maher-press inline-flex items-center justify-center gap-2 rounded-full bg-[var(--maher-text-primary)] px-4 py-2 text-sm font-semibold text-[var(--maher-background)] transition-opacity hover:opacity-90"
              >
                <SquarePen className="h-4 w-4" />
                {t('createOrder')}
              </Link>
              <Link
                href="/dealer/catalog"
                className="maher-press inline-flex items-center justify-center gap-2 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] px-4 py-2 text-sm font-semibold text-[var(--maher-text-primary)] transition-colors hover:bg-[var(--maher-surface-muted)]"
              >
                <ShoppingBag className="h-4 w-4" />
                {t('catalog')}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            <Link href="/dealer/orders" className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
              <Figure value={stats.nearing} size="sm" label={tCommon('metricOrdersNearingDelivery')} tone={stats.nearing > 0 ? 'info' : 'neutral'} locale={locale} />
            </Link>
            <Link href="/dealer/invoices" className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
              <Figure value={stats.openInvoices} size="sm" label={t('invoices')} tone={stats.openInvoices > 0 ? undefined : 'neutral'} locale={locale} />
            </Link>
            <Link href="/dealer/returns" className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
              <Figure value={stats.returnsTotal} size="sm" label={t('returns')} tone={stats.returnsTotal > 0 ? 'warning' : 'neutral'} locale={locale} />
            </Link>
          </div>
        </div>
      </Board>

      <div className="grid gap-5 xl:grid-cols-12 xl:items-stretch">
        <div className="flex flex-col gap-5 xl:col-span-7">
          {/* Order journey */}
          <Board>
            <Board.Header
              title={tCommon('dealerJourneyTitle')}
              description={tCommon('dealerLoadHint')}
              meta={
                <span className="tabular-nums" dir="ltr">
                  {stats.ordersTotal.toLocaleString('en-JO')}
                </span>
              }
            />
            <Board.Body>
              <Ribbon
                legend={false}
                segments={journey.map((s) => ({ key: s.key, value: s.value, label: s.label, tone: s.tone }))}
              />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {journey.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <Link
                      key={s.key}
                      href={s.href}
                      className="maher-press flex flex-col gap-1 rounded-[12px] px-2 py-2 transition-colors hover:bg-[var(--maher-surface-muted)]"
                    >
                      <span className="flex items-center gap-1.5 text-[var(--maher-text-tertiary)]">
                        {i > 0 ? <ArrowRight className="h-3 w-3 rtl:-scale-x-100" aria-hidden /> : null}
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span
                        className={
                          s.value > 0
                            ? 'text-xl font-semibold leading-6 tabular-nums tracking-[-0.02em] text-[var(--maher-text-primary)]'
                            : 'text-xl font-semibold leading-6 tabular-nums text-[var(--maher-text-tertiary)]'
                        }
                        dir="ltr"
                      >
                        {s.value}
                      </span>
                      <span className="text-[12px] leading-4 text-[var(--maher-text-secondary)]">{s.label}</span>
                      <span className="text-[11px] leading-4 tabular-nums text-[var(--maher-text-tertiary)]" dir="ltr">
                        {s.share}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Board.Body>
          </Board>

          {/* Active orders */}
          <Board className="xl:flex-1">
            <Board.Header
              title={tCommon('dealerActiveOrders')}
              description={tCommon('dealerActiveHint')}
              actions={
                <Link href="/dealer/orders" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--maher-brand)]">
                  {tCommon('viewAll')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Link>
              }
            />
            {stats.hub.length === 0 ? (
              <Board.Empty
                icon={<Package className="h-4 w-4" />}
                title={tCommon('dealerNoOrders')}
                action={
                  <Link
                    href="/dealer/orders/new"
                    className="maher-press inline-flex items-center gap-2 rounded-full bg-[var(--maher-text-primary)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--maher-background)]"
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                    {t('createOrder')}
                  </Link>
                }
              />
            ) : (
              <Board.Body grow>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {stats.hub.map((row) => {
                    const href = row.kind === 'rfq' ? `/orders/requests/${row.id}` : `/orders/${row.id}`;
                    const img = mediaSrc(row.imageUrl);
                    const pct = row.kind === 'sales_order' ? progressOf(row) : 8;
                    const title = orderTitle(row);
                    return (
                      <Link
                        key={`${row.kind}-${row.id}`}
                        href={href}
                        className="maher-press group flex flex-col overflow-hidden rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] transition-colors hover:border-[color:color-mix(in_oklab,var(--maher-brand)_28%,var(--maher-border))]"
                      >
                        <div className="relative aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--maher-text-tertiary)]">
                              <Armchair className="h-8 w-8 opacity-40" />
                            </div>
                          )}
                          <div className="absolute start-2 top-2 origin-top-start scale-90">
                            <StatusBadge status={row.status} />
                          </div>
                        </div>
                        <div className="space-y-1.5 p-3">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--maher-text-primary)]">{title}</p>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--maher-surface-muted)]">
                              <div className="maher-meter-fill h-full rounded-full bg-[var(--maher-brand)]" style={{ width: `${pct}%` }} />
                            </div>
                            <Ltr className="text-[11px] font-semibold tabular-nums text-[var(--maher-text-secondary)]">{pct}%</Ltr>
                          </div>
                          <p className="truncate text-[11px] text-[var(--maher-text-tertiary)]">
                            <Ltr>{row.number}</Ltr>
                            {dealerNo(row) ? <> · {tSales('dealerOrderNumber')}: <Ltr>{dealerNo(row)}</Ltr></> : null}
                          </p>
                          {endCustomer(row) ? (
                            <p className="truncate text-[11px] text-[var(--maher-text-tertiary)]">{endCustomer(row)}</p>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Board.Body>
            )}
          </Board>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          {/* Account ledger */}
          <Board tone={stats.openInvoices > 0 ? 'brand' : 'success'}>
            <Board.Header
              title={t('invoices')}
              description={tCommon('ordersSubtitle')}
              meta={
                stats.openInvoices > 0 ? (
                  <Stamp tone="brand" size="sm">
                    {stats.openInvoices}
                  </Stamp>
                ) : null
              }
            />
            <Board.Body>
              <Figure value={money(stats.outstanding, currency)} label={tCommon('metricOutstandingInvoices')} size="sm" locale={locale} />
              <Ledger className="mt-3 border-t border-[var(--maher-border)] pt-1">
                <LedgerRow label={t('myOrders')} value={stats.ordersTotal.toLocaleString('en-JO')} href="/dealer/orders" LinkComponent={Link} icon={<Package className="h-3.5 w-3.5" />} />
                <LedgerRow label={tCommon('dealerCompletedLabel')} value={stats.done.toLocaleString('en-JO')} tone="success" href="/dealer/orders" LinkComponent={Link} icon={<PackageCheck className="h-3.5 w-3.5" />} />
                <LedgerRow label={t('returns')} value={stats.returnsTotal.toLocaleString('en-JO')} tone={stats.returnsTotal > 0 ? 'warning' : 'neutral'} href="/dealer/returns" LinkComponent={Link} icon={<Undo2 className="h-3.5 w-3.5" />} />
                <LedgerRow label={t('statement')} value={<ArrowUpRight className="h-3.5 w-3.5 text-[var(--maher-text-tertiary)] rtl:-scale-x-100" />} href="/dealer/statement" LinkComponent={Link} icon={<Scroll className="h-3.5 w-3.5" />} />
              </Ledger>
            </Board.Body>
          </Board>

          {/* Quick jumps */}
          <Board tone="neutral">
            <Board.Header stamp={false} title={tCommon('quickActions')} description={tCommon('dealerQuickHint')} />
            <Board.Body padding="tight">
              <ul className="m-0 grid list-none grid-cols-1 gap-x-2 p-0 sm:grid-cols-2">
                {shortcuts.map((s) => {
                  const Icon = s.icon;
                  return (
                    <li key={s.href} className="m-0">
                      <Link
                        href={s.href}
                        className="maher-press group/jump flex min-h-[44px] items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm text-[var(--maher-text-primary)] transition-colors hover:bg-[var(--maher-surface-muted)]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)] transition-colors group-hover/jump:bg-[var(--maher-brand-soft)] group-hover/jump:text-[var(--maher-brand)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--maher-text-tertiary)] opacity-0 transition-opacity group-hover/jump:opacity-100 rtl:-scale-x-100" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Board.Body>
          </Board>

          {/* Catalog spotlight */}
          <Board tone="neutral" className="xl:flex-1">
            <Board.Header
              stamp={false}
              title={tCommon('dealerCatalogSpotlight')}
              description={tCommon('dealerCatalogHint')}
              actions={
                <Link href="/dealer/catalog" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--maher-brand)]">
                  {t('catalog')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Link>
              }
            />
            {products.length === 0 ? (
              <Board.Empty title={tCommon('emptyList')} />
            ) : (
              <Board.Body grow>
                <div className="grid grid-cols-2 gap-3">
                  {products.slice(0, 4).map((p) => {
                    const title = localizedName(locale, p) || p.nameEn;
                    const img = mediaSrc(p.imageUrl);
                    const price = Number(p.dealerPrice ?? p.price ?? p.basePrice);
                    return (
                      <Link
                        key={p.id}
                        href={`/dealer/orders/new?productId=${p.id}`}
                        className="maher-press group overflow-hidden rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] transition-colors hover:border-[color:color-mix(in_oklab,var(--maher-brand)_28%,var(--maher-border))]"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--maher-surface-muted)]">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[var(--maher-text-tertiary)]">
                              <Armchair className="h-8 w-8 opacity-40" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-0.5 p-2.5">
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--maher-text-primary)]">{title}</p>
                          {Number.isFinite(price) ? (
                            <p className="text-[13px] font-medium tabular-nums text-[var(--maher-text-secondary)]">
                              <Ltr>
                                {price.toFixed(2)} {currency}
                              </Ltr>
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Board.Body>
            )}
          </Board>
        </div>
      </div>
    </div>
  );
}
