'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import {
  AnimatedValue,
  AttentionChip,
  BentoMetricCard,
  cn,
  ErrorState,
  Ltr,
  QuickActionTile,
  Skeleton,
  StatusBadge,
  useCardMotion,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Armchair,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Factory,
  PackageCheck,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, type CSSProperties } from 'react';

interface RecentOrder {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  customerName: string | null;
  externalOrderNumber: string | null;
  endCustomerName: string | null;
}

interface DashboardMetrics {
  newOrders: number;
  ordersInProduction: number;
  ordersNearingDelivery: number;
  completedOrders: number;
  delayedOrders: number;
  openInvoices: number;
  outstandingReceivables: number;
  dealersActive: number;
  pendingReturns: number;
  lowStockItems: number;
  recentOrders: RecentOrder[];
  generatedAt: string;
}

function money(value: number | undefined, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
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
      glow: 'rgba(217, 58, 43, 0.28)',
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

function RecentOrderCard({
  order,
  systemOrderLabel,
  dealerOrderLabel,
  openLabel,
  delayMs,
}: {
  order: RecentOrder;
  systemOrderLabel: string;
  dealerOrderLabel: string;
  openLabel: string;
  delayMs: number;
}) {
  return (
    <article
      className="maher-lift group flex flex-col overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface shadow-card transition hover:border-brand/35"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <Link
        href={`/sales-orders/${order.id}`}
        className="relative block aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]"
      >
        {order.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={order.imageUrl}
            alt={order.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.07]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary">
            <Armchair className="h-8 w-8 opacity-40 transition group-hover:scale-110" />
            <Ltr className="text-[10px] font-medium uppercase tracking-wide">{order.number}</Ltr>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-90" />
        <div className="absolute start-2 top-2 origin-top-start scale-90">
          <StatusBadge status={order.status} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <Ltr className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
            {order.number}
          </Ltr>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{order.title}</p>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {order.customerName ? (
          <p className="truncate text-xs text-text-secondary">{order.customerName}</p>
        ) : null}
        {order.endCustomerName ? (
          <p className="truncate text-[11px] text-text-tertiary">{order.endCustomerName}</p>
        ) : null}
        {order.externalOrderNumber ? (
          <p className="truncate text-[11px] text-text-secondary">
            <span className="text-text-tertiary">{dealerOrderLabel}: </span>
            <Ltr>{order.externalOrderNumber}</Ltr>
          </p>
        ) : (
          <p className="truncate text-[11px] text-text-secondary">
            <span className="text-text-tertiary">{systemOrderLabel}: </span>
            <Ltr>{order.number}</Ltr>
          </p>
        )}
        <Link
          href={`/sales-orders/${order.id}`}
          className="maher-nudge-icon mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-brand"
        >
          <span>{openLabel}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const currency = tCommon('currency');

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isError, refetch, isSuccess } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardMetrics>('/api/v1/reports/dashboard'),
    refetchInterval: 60_000,
  });

  const firstName = useMemo(() => {
    const name = me.data?.name?.trim();
    if (!name) return null;
    return name.split(/\s+/)[0] ?? name;
  }, [me.data?.name]);

  const attentionTotal = useMemo(() => {
    if (!data) return 0;
    return data.delayedOrders + data.pendingReturns + data.lowStockItems;
  }, [data]);

  const pipelineShares = useMemo(() => {
    if (!data) {
      return { newOrders: 0, production: 0, nearing: 0, completed: 0 };
    }
    const parts = [
      data.newOrders,
      data.ordersInProduction,
      data.ordersNearingDelivery,
      data.completedOrders,
    ] as const;
    const total = parts.reduce((s, n) => s + n, 0);
    if (total <= 0) {
      return { newOrders: 0, production: 0, nearing: 0, completed: 0 };
    }
    const raw = parts.map((n) => (n / total) * 100);
    const rounded = raw.map((n) => Math.round(n));
    const drift = 100 - rounded.reduce((s, n) => s + n, 0);
    if (drift !== 0) {
      let maxIdx = 0;
      for (let i = 1; i < rounded.length; i++) {
        if (rounded[i]! >= rounded[maxIdx]!) maxIdx = i;
      }
      rounded[maxIdx]! += drift;
    }
    return {
      newOrders: rounded[0]!,
      production: rounded[1]!,
      nearing: rounded[2]!,
      completed: rounded[3]!,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-[var(--maher-radius-xl)]" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--maher-radius-xl)]" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-[148px] rounded-[var(--maher-radius-xl)]',
                i === 0 && 'sm:col-span-2 sm:h-[200px]',
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title={t('dashboard')}
        description={tCommon('noResults')}
        onRetry={() => refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const quickActions: Array<{ href: string; label: string; icon: LucideIcon }> = [
    { href: '/orders', label: t('orders'), icon: ShoppingCart },
    { href: '/production', label: t('production'), icon: Factory },
    { href: '/products', label: t('products'), icon: Armchair },
    { href: '/customers', label: t('dealers'), icon: Users },
    { href: '/inventory', label: t('inventory'), icon: Boxes },
    { href: '/purchasing', label: t('purchasing'), icon: Receipt },
    { href: '/invoices', label: t('invoices'), icon: Banknote },
    { href: '/returns', label: t('returns'), icon: RotateCcw },
  ];

  return (
    <div className="space-y-8 pb-4">
      <section
        data-header-contrast="dark"
        className="relative overflow-hidden rounded-[var(--maher-radius-xl)] border border-[#3f342c]/40 bg-[#1c1612] text-white shadow-float"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 80% 70% at 10% 20%, rgba(217,58,43,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 80%, rgba(138,90,43,0.4), transparent 50%), linear-gradient(135deg, #241c16 0%, #1a1410 45%, #2a2018 100%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
          aria-hidden
        />
        <div
          className="maher-animate-spotlight pointer-events-none absolute -start-10 top-0 h-52 w-52 rounded-full bg-[var(--maher-brand)]/25 blur-3xl"
          aria-hidden
        />
        <div
          className="maher-animate-drift pointer-events-none absolute -end-6 bottom-0 h-44 w-44 rounded-full bg-[var(--maher-accent)]/35 blur-3xl"
          aria-hidden
        />
        <div className="pointer-events-none absolute end-12 top-10 h-2.5 w-2.5 rounded-full bg-white/50 maher-animate-orbit" aria-hidden />
        <div
          className="pointer-events-none absolute end-28 top-20 h-2 w-2 rounded-full bg-[var(--maher-brand)] maher-animate-orbit"
          style={{ animationDuration: '12s', animationDelay: '-3s' }}
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="maher-animate-rise max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--maher-brand)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--maher-brand)]" />
              </span>
              {tCommon('dashboardLive')}
              <Sparkles className="h-3.5 w-3.5 text-white/70" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {firstName
                ? tCommon('dashboardGreetingNamed', { name: firstName })
                : tCommon('dashboardGreeting')}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              {tCommon('adminDashboardSubtitle')}
            </p>
            <p className="text-xs text-white/45">
              {tCommon('dashboardUpdated', {
                time: new Date(data.generatedAt).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
          </div>

          <div className="maher-stagger flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
            {attentionTotal === 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                {tCommon('dashboardAllClear')}
              </div>
            ) : (
              <>
                <AttentionChip
                  href="/production"
                  label={tCommon('metricDelayedOrders')}
                  value={data.delayedOrders}
                  tone="error"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  LinkComponent={Link}
                />
                <AttentionChip
                  href="/returns"
                  label={tCommon('metricPendingReturns')}
                  value={data.pendingReturns}
                  tone="warning"
                  icon={<RotateCcw className="h-4 w-4" />}
                  LinkComponent={Link}
                />
                <AttentionChip
                  href="/inventory"
                  label={tCommon('metricLowStock')}
                  value={data.lowStockItems}
                  tone="info"
                  icon={<Boxes className="h-4 w-4" />}
                  LinkComponent={Link}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Factory pipeline */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            {tCommon('adminPipelineTitle')}
          </h2>
          <PipelineFlowHint
            labels={[
              tCommon('metricNewOrders'),
              tCommon('metricOrdersInProduction'),
              tCommon('metricOrdersNearingDelivery'),
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
            href="/orders"
            label={tCommon('metricNewOrders')}
            value={data.newOrders}
            sharePct={pipelineShares.newOrders}
            step={1}
            tone="brand"
            icon={ClipboardList}
            delayMs={0}
          />
          <PipelineStep
            href="/production"
            label={tCommon('metricOrdersInProduction')}
            value={data.ordersInProduction}
            sharePct={pipelineShares.production}
            step={2}
            tone="info"
            icon={Factory}
            delayMs={70}
          />
          <PipelineStep
            href="/sales-orders"
            label={tCommon('metricOrdersNearingDelivery')}
            value={data.ordersNearingDelivery}
            sharePct={pipelineShares.nearing}
            step={3}
            tone="warning"
            icon={Truck}
            delayMs={140}
          />
          <PipelineStep
            href="/sales-orders?status=COMPLETED"
            label={tCommon('dealerStageDone')}
            value={data.completedOrders}
            sharePct={pipelineShares.completed}
            step={4}
            tone="success"
            icon={PackageCheck}
            delayMs={210}
          />
        </div>
      </section>

      {/* Pipeline share — bar matches the four stats beneath */}
      <section className="maher-animate-rise overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{tCommon('adminLoadTitle')}</h2>
            <p className="mt-0.5 text-sm text-text-secondary">{tCommon('adminLoadHint')}</p>
          </div>
        </div>
        <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="maher-bar-grow bg-[var(--maher-brand)] transition-all"
            style={{ width: `${pipelineShares.newOrders}%` }}
            title={tCommon('metricNewOrders')}
          />
          <div
            className="maher-bar-grow bg-[var(--maher-info)] transition-all"
            style={{ width: `${pipelineShares.production}%`, animationDelay: '80ms' }}
            title={tCommon('metricOrdersInProduction')}
          />
          <div
            className="maher-bar-grow bg-[var(--maher-warning)] transition-all"
            style={{ width: `${pipelineShares.nearing}%`, animationDelay: '160ms' }}
            title={tCommon('metricOrdersNearingDelivery')}
          />
          <div
            className="maher-bar-grow bg-[var(--maher-success)] transition-all"
            style={{ width: `${pipelineShares.completed}%`, animationDelay: '240ms' }}
            title={tCommon('dealerStageDone')}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RingStat
            value={data.newOrders}
            sharePct={pipelineShares.newOrders}
            label={tCommon('metricNewOrders')}
            tone="brand"
          />
          <RingStat
            value={data.ordersInProduction}
            sharePct={pipelineShares.production}
            label={tCommon('metricOrdersInProduction')}
            tone="info"
          />
          <RingStat
            value={data.ordersNearingDelivery}
            sharePct={pipelineShares.nearing}
            label={tCommon('metricOrdersNearingDelivery')}
            tone="warning"
          />
          <RingStat
            value={data.completedOrders}
            sharePct={pipelineShares.completed}
            label={tCommon('dealerStageDone')}
            tone="success"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-brand)]" />
            {tCommon('metricNewOrders')} · <span dir="ltr">{pipelineShares.newOrders}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-info)]" />
            {tCommon('metricOrdersInProduction')} ·{' '}
            <span dir="ltr">{pipelineShares.production}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-warning)]" />
            {tCommon('metricOrdersNearingDelivery')} ·{' '}
            <span dir="ltr">{pipelineShares.nearing}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--maher-success)]" />
            {tCommon('dealerStageDone')} · <span dir="ltr">{pipelineShares.completed}%</span>
          </span>
        </div>
      </section>

      {/* Bento metrics */}
      <section className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2">
          <BentoMetricCard
            href="/orders"
            label={tCommon('metricNewOrders')}
            hint={tCommon('dashboardHintNewOrders')}
            value={<AnimatedValue value={data.newOrders} enabled={isSuccess} />}
            icon={<ClipboardList className="h-5 w-5" />}
            tone="brand"
            featured
            delayMs={0}
            animateValue={isSuccess}
            trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            LinkComponent={Link}
          />
        </div>
        <BentoMetricCard
          href="/production"
          label={tCommon('metricOrdersInProduction')}
          value={<AnimatedValue value={data.ordersInProduction} enabled={isSuccess} />}
          icon={<Factory className="h-5 w-5" />}
          tone="info"
          delayMs={200}
          animateValue={isSuccess}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/sales-orders"
          label={tCommon('metricOrdersNearingDelivery')}
          value={<AnimatedValue value={data.ordersNearingDelivery} enabled={isSuccess} />}
          icon={<PackageCheck className="h-5 w-5" />}
          tone="warning"
          delayMs={400}
          animateValue={isSuccess}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/sales-orders?status=COMPLETED"
          label={tCommon('metricCompletedOrders')}
          value={<AnimatedValue value={data.completedOrders} enabled={isSuccess} />}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          delayMs={600}
          animateValue={isSuccess}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/invoices"
          label={tCommon('metricOutstandingInvoices')}
          hint={money(data.outstandingReceivables, currency)}
          value={<AnimatedValue value={data.openInvoices} enabled={isSuccess} />}
          icon={<Banknote className="h-5 w-5" />}
          tone="accent"
          delayMs={800}
          animateValue={isSuccess}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/customers"
          label={tCommon('metricActiveDealers')}
          value={<AnimatedValue value={data.dealersActive} enabled={isSuccess} />}
          icon={<Users className="h-5 w-5" />}
          tone="info"
          delayMs={1000}
          animateValue={isSuccess}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
        <BentoMetricCard
          href="/returns"
          label={tCommon('metricPendingReturns')}
          value={<AnimatedValue value={data.pendingReturns} enabled={isSuccess} />}
          icon={<RotateCcw className="h-5 w-5" />}
          tone={data.pendingReturns > 0 ? 'warning' : 'accent'}
          delayMs={1200}
          animateValue={isSuccess}
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          LinkComponent={Link}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-text-primary">
              {tCommon('quickActions')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{tCommon('dashboardQuickHint')}</p>
          </div>
        </div>
        <div className="maher-stagger flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-8">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <QuickActionTile
                key={action.href}
                href={action.href}
                label={action.label}
                icon={<Icon className="h-5 w-5" />}
                delayMs={i * 40}
                trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                LinkComponent={Link}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-text-primary">
              {tCommon('dashboardRecentOrders')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{tCommon('dashboardRecentHint')}</p>
          </div>
          <Link
            href="/sales-orders"
            className="maher-nudge-icon inline-flex items-center gap-1 text-sm font-semibold text-brand"
          >
            {tCommon('viewAll')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {(data.recentOrders ?? []).length === 0 ? (
          <div className="rounded-[var(--maher-radius-xl)] border border-dashed border-border bg-surface-muted/60 px-6 py-12 text-center">
            <Armchair className="mx-auto mb-3 h-8 w-8 text-text-tertiary opacity-50" />
            <p className="text-sm text-text-secondary">{tCommon('dashboardNoRecentOrders')}</p>
          </div>
        ) : (
          <div className="maher-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.recentOrders.map((order, i) => (
              <RecentOrderCard
                key={order.id}
                order={order}
                systemOrderLabel={tSales('systemOrderNumber')}
                dealerOrderLabel={tSales('dealerOrderNumber')}
                openLabel={tCommon('details')}
                delayMs={i * 50}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
