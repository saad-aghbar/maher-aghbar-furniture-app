'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import type { AuthUser } from '@maher/types';
import {
  AnimatedValue,
  AttentionChip,
  BentoMetricCard,
  ErrorState,
  Ltr,
  QuickActionTile,
  Skeleton,
  StatusBadge,
  useCardMotion,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Armchair,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
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
import { useMemo, type CSSProperties } from 'react';

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

function PipelineFlowHint({ labels }: { labels: string[] }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-text-secondary">
      {labels.map((label, i) => (
        <span key={`${label}-${i}`} className="inline-flex items-center gap-1.5">
          {i > 0 ? (
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-text-tertiary rtl:rotate-180"
              aria-hidden
            />
          ) : null}
          <span>{label}</span>
        </span>
      ))}
    </p>
  );
}

function RingStat({
  value,
  sharePct,
  label,
  tone,
}: {
  value: number;
  sharePct: number;
  label: string;
  tone: 'brand' | 'info' | 'warning' | 'success';
}) {
  const pct = Math.min(100, Math.max(0, sharePct));
  const colors = {
    brand: 'var(--maher-brand)',
    info: 'var(--maher-info)',
    warning: 'var(--maher-warning)',
    success: 'var(--maher-success)',
  }[tone];
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex items-center gap-3 rounded-[var(--maher-radius-lg)] border border-border bg-[var(--maher-surface-muted)]/50 px-3 py-2.5">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--maher-border)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={colors}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-text-primary">
          <span dir="ltr">{value}</span>
          <span className="ms-1 text-xs font-medium text-text-tertiary">
            <span dir="ltr">{pct}%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

function PipelineStep({
  href,
  label,
  value,
  sharePct,
  step,
  tone,
  icon: Icon,
  delayMs,
}: {
  href: string;
  label: string;
  value: number;
  sharePct: number;
  step: number;
  tone: 'brand' | 'info' | 'warning' | 'success';
  icon: LucideIcon;
  delayMs: number;
}) {
  const { ref, onMove, onLeave } = useCardMotion<HTMLAnchorElement>(8);
  const pct = Math.min(100, Math.max(0, sharePct));
  const circumference = 88;
  const offset = circumference - (pct / 100) * circumference;

  const toneVars: Record<typeof tone, { accent: string; soft: string; glow: string }> = {
    brand: {
      accent: 'var(--maher-brand)',
      soft: 'var(--maher-brand-soft)',
      glow: 'rgba(119, 98, 69, 0.28)',
    },
    info: {
      accent: 'var(--maher-info)',
      soft: 'var(--maher-info-soft)',
      glow: 'rgba(28, 84, 144, 0.28)',
    },
    warning: {
      accent: 'var(--maher-warning)',
      soft: 'var(--maher-warning-soft)',
      glow: 'rgba(154, 106, 6, 0.28)',
    },
    success: {
      accent: 'var(--maher-success)',
      soft: 'var(--maher-success-soft)',
      glow: 'rgba(23, 112, 90, 0.28)',
    },
  };
  const vars = toneVars[tone];

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="maher-pipeline-card maher-press group relative z-[1] flex min-w-[110px] flex-1 flex-col items-center gap-1.5 rounded-[var(--maher-radius-lg)] border border-border bg-surface px-2.5 py-3.5 text-center shadow-card"
      style={
        {
          animationDelay: `${delayMs}ms`,
          ['--pipe-accent']: vars.accent,
          ['--pipe-soft']: vars.soft,
          ['--pipe-glow']: vars.glow,
        } as CSSProperties
      }
    >
      <span className="maher-pipe-orb" aria-hidden />
      <div className="maher-pipe-icon-wrap relative z-[3]">
        <span className="maher-pipe-step" aria-hidden>
          {step}
        </span>
        <svg className="maher-pipe-ring" viewBox="0 0 36 36" aria-hidden>
          <circle className="maher-pipe-ring-track" cx="18" cy="18" r="14" />
          <circle
            className="maher-pipe-ring-value"
            cx="18"
            cy="18"
            r="14"
            style={{ strokeDashoffset: offset }}
          />
        </svg>
        <span className="maher-pipe-icon">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="maher-pipe-label relative z-[3] text-xs font-medium text-text-secondary">
        {label}
      </p>
      <p className="maher-pipe-value relative z-[3] text-xl font-semibold tabular-nums text-text-primary">
        <span dir="ltr">{value}</span>
      </p>
      <span className="maher-pipe-chip relative z-[3] rounded-full border border-border bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-text-secondary">
        <span dir="ltr">{pct}%</span>
      </span>
    </Link>
  );
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

  return (
    <div className="space-y-8 pb-6">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] text-[var(--maher-text-primary)] shadow-[var(--maher-shadow-sm)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-0 w-[3px] bg-[var(--maher-brand)] opacity-55"
        />
        <div className="relative flex flex-col gap-6 p-6 ps-7 sm:p-8 sm:ps-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="maher-animate-rise max-w-2xl space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {firstName
                ? tCommon('dealerGreetingNamed', { name: firstName })
                : tCommon('dealerGreeting')}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-[var(--maher-text-secondary)]">
              {tCommon('dealerDashboardSubtitle')}
            </p>
            <p className="text-xs text-[var(--maher-text-tertiary)]">
              {tCommon('dashboardUpdated', { time: updatedAt })}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/dealer/orders/new"
                className="maher-press maher-sheen group inline-flex items-center justify-center gap-2 rounded-[var(--maher-radius-lg)] bg-[var(--maher-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-elevated transition hover:bg-[var(--maher-brand-hover)]"
              >
                <SquarePen className="h-4 w-4 transition group-hover:rotate-6" />
                {t('createOrder')}
                <ArrowUpRight className="h-4 w-4 opacity-80" />
              </Link>
              <Link
                href="/dealer/catalog"
                className="maher-press inline-flex items-center justify-center gap-2 rounded-full border border-[var(--maher-border-strong)] bg-[var(--maher-surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--maher-text-primary)]"
              >
                <ShoppingBag className="h-4 w-4" />
                {t('catalog')}
              </Link>
            </div>
          </div>

          <div className="maher-stagger flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
            {attentionTotal === 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--maher-border)] bg-[var(--maher-success-soft)] px-3.5 py-2 text-sm font-medium text-[var(--maher-success)]">
                <CheckCircle2 className="h-4 w-4" />
                {tCommon('dashboardAllClear')}
              </div>
            ) : (
              <>
                <AttentionChip
                  href="/dealer/orders"
                  label={tCommon('metricOrdersNearingDelivery')}
                  value={stats.nearing}
                  tone="warning"
                  icon={<Truck className="h-4 w-4" />}
                  LinkComponent={Link}
                />
                <AttentionChip
                  href="/dealer/invoices"
                  label={t('invoices')}
                  value={stats.openInvoices}
                  tone="info"
                  icon={<Receipt className="h-4 w-4" />}
                  LinkComponent={Link}
                />
                <AttentionChip
                  href="/dealer/returns"
                  label={t('returns')}
                  value={stats.returnsTotal}
                  tone="error"
                  icon={<Undo2 className="h-4 w-4" />}
                  LinkComponent={Link}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Order journey — same polish as admin pipeline */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            {tCommon('dealerJourneyTitle')}
          </h2>
          <PipelineFlowHint
            labels={[
              tCommon('dealerStageRequest'),
              tCommon('dealerStageProduction'),
              tCommon('dealerStageDelivery'),
              tCommon('dealerStageDone'),
            ]}
          />
        </div>
        <div className="maher-stagger relative flex gap-2 overflow-x-auto overflow-y-visible py-1 sm:gap-3 sm:overflow-visible">
          <div
            className="pointer-events-none absolute start-12 end-12 top-[2.45rem] hidden h-px bg-gradient-to-r from-[var(--maher-brand)]/50 via-[var(--maher-info)]/35 via-40% via-[var(--maher-warning)]/35 to-[var(--maher-success)]/50 sm:block rtl:bg-gradient-to-l"
            aria-hidden
          />
          <PipelineStep
            href="/dealer/orders"
            label={tCommon('dealerStageRequest')}
            value={stats.rfqOpen}
            sharePct={journeyShares.request}
            step={1}
            tone="brand"
            icon={ClipboardList}
            delayMs={0}
          />
          <PipelineStep
            href="/dealer/orders"
            label={tCommon('dealerStageProduction')}
            value={stats.inProduction}
            sharePct={journeyShares.production}
            step={2}
            tone="info"
            icon={Factory}
            delayMs={70}
          />
          <PipelineStep
            href="/dealer/orders"
            label={tCommon('dealerStageDelivery')}
            value={stats.nearing}
            sharePct={journeyShares.nearing}
            step={3}
            tone="warning"
            icon={Truck}
            delayMs={140}
          />
          <PipelineStep
            href="/dealer/orders"
            label={tCommon('dealerStageDone')}
            value={stats.done}
            sharePct={journeyShares.done}
            step={4}
            tone="success"
            icon={PackageCheck}
            delayMs={210}
          />
        </div>
      </section>

      {/* Order mix — mirrors admin load section */}
      <section className="maher-animate-rise overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text-primary">{tCommon('dealerLoadTitle')}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{tCommon('dealerLoadHint')}</p>
        </div>
        <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="maher-bar-grow bg-[var(--maher-brand)] transition-all"
            style={{ width: `${journeyShares.request}%` }}
          />
          <div
            className="maher-bar-grow bg-[var(--maher-info)] transition-all"
            style={{ width: `${journeyShares.production}%`, animationDelay: '80ms' }}
          />
          <div
            className="maher-bar-grow bg-[var(--maher-warning)] transition-all"
            style={{ width: `${journeyShares.nearing}%`, animationDelay: '160ms' }}
          />
          <div
            className="maher-bar-grow bg-[var(--maher-success)] transition-all"
            style={{ width: `${journeyShares.done}%`, animationDelay: '240ms' }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RingStat
            value={stats.rfqOpen}
            sharePct={journeyShares.request}
            label={tCommon('dealerStageRequest')}
            tone="brand"
          />
          <RingStat
            value={stats.inProduction}
            sharePct={journeyShares.production}
            label={tCommon('dealerStageProduction')}
            tone="info"
          />
          <RingStat
            value={stats.nearing}
            sharePct={journeyShares.nearing}
            label={tCommon('dealerStageDelivery')}
            tone="warning"
          />
          <RingStat
            value={stats.done}
            sharePct={journeyShares.done}
            label={tCommon('dealerStageDone')}
            tone="success"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-brand)]" />
            {tCommon('dealerStageRequest')} · <span dir="ltr">{journeyShares.request}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-info)]" />
            {tCommon('dealerStageProduction')} · <span dir="ltr">{journeyShares.production}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-warning)]" />
            {tCommon('dealerStageDelivery')} · <span dir="ltr">{journeyShares.nearing}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-success)]" />
            {tCommon('dealerStageDone')} · <span dir="ltr">{journeyShares.done}%</span>
          </span>
        </div>
      </section>

      {/* Metrics */}
      <section className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2">
          <BentoMetricCard
            href="/dealer/orders"
            label={t('myOrders')}
            hint={tCommon('ordersSubtitle')}
            value={<AnimatedValue value={stats.ordersTotal} enabled={ready} />}
            icon={<Package className="h-5 w-5" />}
            tone="brand"
            featured
            delayMs={0}
            animateValue={ready}
            trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            LinkComponent={Link}
          />
        </div>
        <BentoMetricCard
          href="/dealer/orders"
          label={tCommon('metricOrdersInProduction')}
          hint={tCommon('dealerHintProduction')}
          value={<AnimatedValue value={stats.inProduction} enabled={ready} />}
          icon={<Factory className="h-5 w-5" />}
          tone="info"
          delayMs={200}
          animateValue={ready}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/dealer/orders"
          label={tCommon('metricOrdersNearingDelivery')}
          value={<AnimatedValue value={stats.nearing} enabled={ready} />}
          icon={<Truck className="h-5 w-5" />}
          tone="warning"
          delayMs={400}
          animateValue={ready}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/dealer/orders"
          label={tCommon('dealerCompletedLabel')}
          value={<AnimatedValue value={stats.done} enabled={ready} />}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          delayMs={600}
          animateValue={ready}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/dealer/invoices"
          label={t('invoices')}
          hint={money(stats.outstanding, currency)}
          value={<AnimatedValue value={stats.openInvoices} enabled={ready} />}
          icon={<Receipt className="h-5 w-5" />}
          tone="accent"
          delayMs={800}
          animateValue={ready}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/dealer/returns"
          label={t('returns')}
          hint={tCommon('returnsSubtitle')}
          value={<AnimatedValue value={stats.returnsTotal} enabled={ready} />}
          icon={<Undo2 className="h-5 w-5" />}
          tone={stats.returnsTotal > 0 ? 'warning' : 'accent'}
          delayMs={1000}
          animateValue={ready}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/dealer/catalog"
          label={t('catalog')}
          hint={tCommon('dealerCatalogHint')}
          value={<AnimatedValue value={products.length} enabled={catalog.isSuccess} />}
          icon={<ShoppingBag className="h-5 w-5" />}
          tone="info"
          delayMs={1200}
          animateValue={catalog.isSuccess}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            {tCommon('quickActions')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{tCommon('dealerQuickHint')}</p>
        </div>
        <div className="maher-stagger flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-4 lg:grid-cols-7 sm:overflow-visible">
          {shortcuts.map((s, i) => {
            const Icon = s.icon;
            return (
              <QuickActionTile
                key={s.href}
                href={s.href}
                label={s.label}
                icon={<Icon className="h-5 w-5" />}
                delayMs={i * 40}
                trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                LinkComponent={Link}
              />
            );
          })}
        </div>
      </section>

      {/* Active orders */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-text-primary">
              {tCommon('dealerActiveOrders')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{tCommon('dealerActiveHint')}</p>
          </div>
          <Link
            href="/dealer/orders"
            className="maher-nudge-icon inline-flex items-center gap-1 text-sm font-semibold text-brand"
          >
            {tCommon('viewAll')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {stats.hub.length === 0 ? (
          <div className="rounded-[var(--maher-radius-xl)] border border-dashed border-border bg-surface-muted/50 px-6 py-12 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-text-tertiary opacity-45" />
            <p className="text-sm text-text-secondary">{tCommon('dealerNoOrders')}</p>
            <Link
              href="/dealer/orders/new"
              className="maher-press mt-4 inline-flex items-center gap-2 rounded-[var(--maher-radius-md)] bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              <SquarePen className="h-4 w-4" />
              {t('createOrder')}
            </Link>
          </div>
        ) : (
          <div className="maher-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.hub.map((row, i) => {
              const href = row.kind === 'rfq' ? `/orders/requests/${row.id}` : `/orders/${row.id}`;
              const img = mediaSrc(row.imageUrl);
              const pct = row.kind === 'sales_order' ? progressOf(row) : 8;
              const title = orderTitle(row);
              return (
                <article
                  key={`${row.kind}-${row.id}`}
                  className="maher-dash-card group overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface shadow-card"
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  <Link href={href} className="relative block aspect-[5/4] overflow-hidden bg-surface-muted">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={title}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.07]"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-text-tertiary">
                        <Armchair className="h-8 w-8 opacity-40 transition group-hover:scale-110" />
                        <Ltr className="text-[10px] font-medium uppercase tracking-wide">{row.number}</Ltr>
                      </div>
                    )}
                    <div className="absolute start-2 top-2 origin-top-start scale-90">
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 space-y-1.5 border-t border-[var(--maher-border)] bg-[var(--maher-surface)]/95 p-2.5">
                      <p className="line-clamp-2 text-sm font-semibold text-[var(--maher-text-primary)]">{title}</p>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--maher-surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--maher-brand)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <Ltr className="text-[11px] font-semibold text-[var(--maher-text-secondary)]">{pct}%</Ltr>
                      </div>
                    </div>
                  </Link>
                  <div className="space-y-1 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      <Ltr>{row.number}</Ltr>
                    </p>
                    {dealerNo(row) ? (
                      <p className="truncate text-[11px] text-text-secondary">
                        <span className="text-text-tertiary">{tSales('dealerOrderNumber')}: </span>
                        <Ltr>{dealerNo(row)}</Ltr>
                      </p>
                    ) : null}
                    {endCustomer(row) ? (
                      <p className="truncate text-[11px] text-text-tertiary">{endCustomer(row)}</p>
                    ) : null}
                    <Link
                      href={href}
                      className="maher-nudge-icon inline-flex items-center gap-1 pt-1 text-xs font-semibold text-brand"
                    >
                      {tCommon('details')}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Catalog spotlight */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-text-primary">
              {tCommon('dealerCatalogSpotlight')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{tCommon('dealerCatalogHint')}</p>
          </div>
          <Link
            href="/dealer/catalog"
            className="maher-nudge-icon inline-flex items-center gap-1 text-sm font-semibold text-brand"
          >
            {t('catalog')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="rounded-[var(--maher-radius-xl)] border border-dashed border-border px-6 py-10 text-center text-sm text-text-secondary">
            {tCommon('emptyList')}
          </div>
        ) : (
          <div className="maher-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((p, i) => {
              const title = localizedName(locale, p) || p.nameEn;
              const img = mediaSrc(p.imageUrl);
              const price = Number(p.dealerPrice ?? p.price ?? p.basePrice);
              return (
                <Link
                  key={p.id}
                  href={`/dealer/orders/new?productId=${p.id}`}
                  className="maher-dash-card maher-sheen group overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface shadow-card"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={title}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-text-tertiary">
                        <Armchair className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition group-hover:opacity-100" />
                    <span className="absolute bottom-2 end-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white opacity-0 shadow-md transition group-hover:opacity-100">
                      <SquarePen className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-text-primary">{title}</p>
                    {Number.isFinite(price) ? (
                      <p className="text-sm font-medium text-accent">
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
        )}
      </section>
    </div>
  );
}
