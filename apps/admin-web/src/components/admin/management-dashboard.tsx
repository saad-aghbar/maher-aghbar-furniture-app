'use client';

import { Link } from '@/i18n/navigation';
import {
  sectionTileSum,
  tileLink,
  tileValues,
  type ManagementSummary,
  type MgmtAttentionCard,
  type MgmtTile,
} from '@/lib/management-summary';
import {
  AnimatedValue,
  AttentionChip,
  BentoMetricCard,
  cn,
  MetricCard,
  Skeleton,
} from '@maher/ui';
import {
  AlertTriangle,
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
  Sparkles,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

function money(value: number | undefined, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toLocaleString('en-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function tileLabel(
  t: (key: string) => string,
  key: string,
  fallback?: string,
): string {
  const i18nKey = `mgmtTile_${key}`;
  try {
    const label = t(i18nKey as never);
    if (label && label !== i18nKey) return label;
  } catch {
    /* missing key */
  }
  if (fallback) return fallback;
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function SectionShell({
  title,
  hint,
  children,
  empty,
  emptyLabel,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  empty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-text-secondary">{hint}</p> : null}
      </div>
      {empty ? (
        <div className="rounded-[var(--maher-radius-xl)] border border-dashed border-border bg-surface-muted/50 px-5 py-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-[var(--maher-success)] opacity-80" />
          <p className="text-sm text-text-secondary">{emptyLabel}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function TileGrid({
  tiles,
  labelFor,
  delayBase = 0,
  featuredFirst,
}: {
  tiles: MgmtTile[];
  labelFor: (tile: MgmtTile) => string;
  delayBase?: number;
  featuredFirst?: boolean;
}) {
  if (!tiles.length) return null;
  return (
    <div className="maher-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile, i) => (
        <div key={tile.key} className={featuredFirst && i === 0 ? 'sm:col-span-2' : undefined}>
          <BentoMetricCard
            href={tileLink(tile.href, tile.filter)}
            label={labelFor(tile)}
            value={<AnimatedValue value={tile.count} enabled />}
            icon={<ClipboardList className="h-5 w-5" />}
            tone={tile.count > 0 && /block|late|overdue|fail|attention/i.test(tile.key) ? 'warning' : 'brand'}
            featured={Boolean(featuredFirst && i === 0)}
            delayMs={delayBase + i * 60}
            animateValue
            trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            LinkComponent={Link}
          />
        </div>
      ))}
    </div>
  );
}

function AttentionList({
  cards,
  allClearLabel,
}: {
  cards: MgmtAttentionCard[];
  allClearLabel: string;
}) {
  if (!cards.length) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2 text-sm font-medium text-[var(--maher-success)]">
        <CheckCircle2 className="h-4 w-4" />
        {allClearLabel}
      </div>
    );
  }
  const shown = cards.slice(0, 4);
  return (
    <div className="maher-stagger flex flex-wrap gap-2">
      {shown.map((card, i) => (
        <AttentionChip
          key={card.id}
          href={tileLink(card.href, card.filter)}
          label={`${card.title}: ${card.why}`}
          value={i + 1}
          tone={card.priority === 'critical' ? 'error' : card.priority === 'high' ? 'warning' : 'info'}
          icon={<AlertTriangle className="h-4 w-4" />}
          LinkComponent={Link}
        />
      ))}
    </div>
  );
}

function FactoryFlowStrip({
  steps,
}: {
  steps: ManagementSummary['factoryFlow'];
}) {
  if (!steps.length) return null;
  const total = steps.reduce((s, x) => s + x.count, 0) || 1;
  return (
    <div className="maher-stagger relative flex gap-2 overflow-x-auto py-1 sm:gap-3 sm:overflow-visible">
      <div
        className="pointer-events-none absolute start-12 end-12 top-[2.2rem] hidden h-px bg-gradient-to-r from-[var(--maher-brand)]/40 via-[var(--maher-info)]/30 to-[var(--maher-success)]/40 sm:block rtl:bg-gradient-to-l"
        aria-hidden
      />
      {steps.map((step, i) => {
        const pct = Math.round((step.count / total) * 100);
        return (
          <Link
            key={step.key}
            href={tileLink(step.href, step.filter)}
            className="maher-pipeline-card maher-press relative z-[1] flex min-w-[100px] flex-1 flex-col items-center gap-1 rounded-[var(--maher-radius-lg)] border border-border bg-surface px-2.5 py-3 text-center shadow-card"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
              {i + 1}
            </span>
            <p className="text-xs font-medium text-text-secondary">{step.label}</p>
            <p className="text-xl font-semibold tabular-nums text-text-primary">
              <span dir="ltr">{step.count}</span>
            </p>
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] tabular-nums text-text-secondary">
              <span dir="ltr">{pct}%</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function ActivityList({
  items,
  emptyLabel,
}: {
  items: Array<{ at: string; label: string; href?: string }>;
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-[var(--maher-radius-xl)] border border-dashed border-border bg-surface-muted/50 px-5 py-8 text-center">
        <p className="text-sm text-text-secondary">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface shadow-card">
      {items.map((item, i) => {
        const body = (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{item.label}</p>
              <p className="mt-0.5 text-xs text-text-tertiary" dir="ltr">
                {new Date(item.at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            {item.href ? <ArrowUpRight className="h-4 w-4 shrink-0 text-brand" /> : null}
          </div>
        );
        return (
          <li key={`${item.at}-${i}`}>
            {item.href ? (
              <Link href={item.href} className="block transition hover:bg-surface-muted/60">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ManagementDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 w-full rounded-[var(--maher-radius-xl)]" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--maher-radius-xl)]" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-[var(--maher-radius-xl)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[148px] rounded-[var(--maher-radius-xl)]" />
        ))}
      </div>
    </div>
  );
}

export function ManagementDashboard({
  data,
  firstName,
}: {
  data: ManagementSummary;
  firstName: string | null;
}) {
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const currency = tCommon('currency');

  const labelFor = (tile: MgmtTile) => tileLabel(tCommon, tile.key);

  const todayTiles = useMemo(() => tileValues(data.today), [data.today]);
  const productionTiles = useMemo(
    () =>
      tileValues({
        activeOrders: data.production.activeOrders,
        tasksCompletedToday: data.production.tasksCompletedToday,
        blocked: data.production.blocked,
        dueToday: data.production.dueToday,
      }),
    [data.production],
  );
  const outboundTiles = useMemo(() => tileValues(data.outbound), [data.outbound]);
  const materialsTiles = useMemo(() => tileValues(data.materials), [data.materials]);
  const inventoryTiles = useMemo(
    () => (data.inventory ? tileValues(data.inventory) : []),
    [data.inventory],
  );
  const qualityTiles = useMemo(
    () => (data.quality ? tileValues(data.quality) : []),
    [data.quality],
  );
  const exceptionsTiles = useMemo(() => {
    if (!data.exceptions) return [];
    return tileValues(data.exceptions).filter((t) => t.count > 0);
  }, [data.exceptions]);

  const attentionEmpty = !data.attention.length;
  const todayEmpty = sectionTileSum(todayTiles) === 0;
  const flowEmpty = !data.factoryFlow.length || data.factoryFlow.every((s) => s.count === 0);
  const productionEmpty = sectionTileSum(productionTiles) === 0;
  const outboundEmpty = sectionTileSum(outboundTiles) === 0;
  const materialsEmpty = sectionTileSum(materialsTiles) === 0;
  const inventoryEmpty = sectionTileSum(inventoryTiles) === 0;
  const qualityEmpty = sectionTileSum(qualityTiles) === 0;
  const activityEmpty = !data.activity.length;

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
              'radial-gradient(ellipse 80% 70% at 10% 20%, color-mix(in srgb, var(--maher-brand) 35%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 80%, color-mix(in srgb, var(--maher-accent) 40%, transparent), transparent 50%), linear-gradient(135deg, #2a2425 0%, #1e1a1b 45%, #322c2d 100%)',
          }}
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
              {tCommon('mgmtDashboardSubtitle')}
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
          <div className="lg:max-w-md lg:justify-end">
            <AttentionList cards={data.attention} allClearLabel={tCommon('dashboardAllClear')} />
          </div>
        </div>
      </section>

      {/* 1. Attention */}
      <SectionShell
        title={tCommon('mgmtSectionAttention')}
        hint={tCommon('mgmtSectionAttentionHint')}
        empty={attentionEmpty}
        emptyLabel={tCommon('dashboardAllClear')}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.attention.slice(0, 6).map((card) => (
              <Link
                key={card.id}
                href={tileLink(card.href, card.filter)}
                className={cn(
                  'maher-lift rounded-[var(--maher-radius-lg)] border border-border bg-surface p-4 shadow-card transition hover:border-brand/35',
                  card.priority === 'critical' && 'border-[var(--maher-error)]/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-text-primary">{card.title}</p>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-brand" />
                </div>
                <p className="mt-1 text-sm text-text-secondary">{card.why}</p>
                <p className="mt-2 text-xs font-semibold text-brand">{card.actionLabel}</p>
              </Link>
            ))}
          </div>
          {data.late?.overdue ? (
            <BentoMetricCard
              href={tileLink(data.late.overdue.href, data.late.overdue.filter)}
              label={labelFor(data.late.overdue)}
              value={<AnimatedValue value={data.late.overdue.count} enabled />}
              icon={<AlertTriangle className="h-5 w-5" />}
              tone={data.late.overdue.count > 0 ? 'error' : 'success'}
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
              LinkComponent={Link}
            />
          ) : null}
        </div>
      </SectionShell>

      {/* 2. Today */}
      <SectionShell
        title={tCommon('mgmtSectionToday')}
        hint={tCommon('mgmtSectionTodayHint')}
        empty={todayEmpty}
        emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
      >
        <TileGrid tiles={todayTiles} labelFor={labelFor} />
      </SectionShell>

      {/* 3. Factory Flow */}
      <SectionShell
        title={tCommon('mgmtSectionFactoryFlow')}
        hint={tCommon('mgmtSectionFactoryFlowHint')}
        empty={flowEmpty}
        emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
      >
        <FactoryFlowStrip steps={data.factoryFlow} />
      </SectionShell>

      {/* 4. Production */}
      <SectionShell
        title={tNav('production')}
        hint={tCommon('mgmtSectionProductionHint')}
        empty={productionEmpty}
        emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
      >
        <div className="space-y-4">
          <TileGrid tiles={productionTiles} labelFor={labelFor} />
          {data.production.events?.length ? (
            <ActivityList items={data.production.events} emptyLabel={tCommon('mgmtSectionEmptyHealthy')} />
          ) : null}
          {data.blocked?.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">{tCommon('mgmtBlockedTitle')}</h3>
              <ul className="space-y-2">
                {data.blocked.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    <Link
                      href={tileLink(row.href, row.filter)}
                      className="flex items-start justify-between gap-2 rounded-[var(--maher-radius-lg)] border border-border bg-surface px-3 py-2.5 text-sm shadow-card hover:border-brand/30"
                    >
                      <span>
                        <span className="font-medium text-text-primary">{row.title}</span>
                        <span className="mt-0.5 block text-text-secondary">{row.why}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-brand rtl:rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionShell>

      {/* 5. Outbound */}
      <SectionShell
        title={tCommon('mgmtSectionOutbound')}
        hint={tCommon('mgmtSectionOutboundHint')}
        empty={outboundEmpty}
        emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
      >
        <TileGrid tiles={outboundTiles} labelFor={labelFor} />
      </SectionShell>

      {/* 6. Materials */}
      <SectionShell
        title={tCommon('mgmtSectionMaterials')}
        hint={tCommon('mgmtSectionMaterialsHint')}
        empty={materialsEmpty}
        emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
      >
        <TileGrid tiles={materialsTiles} labelFor={labelFor} />
      </SectionShell>

      {/* 6b. Inventory / Quality / Exceptions */}
      {inventoryTiles.length > 0 ? (
        <SectionShell
          title={tCommon('mgmtSectionInventory')}
          hint={tCommon('mgmtSectionInventoryHint')}
          empty={inventoryEmpty}
          emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
        >
          <TileGrid tiles={inventoryTiles} labelFor={labelFor} />
        </SectionShell>
      ) : null}

      {qualityTiles.length > 0 ? (
        <SectionShell
          title={tCommon('mgmtSectionQuality')}
          hint={tCommon('mgmtSectionQualityHint')}
          empty={qualityEmpty}
          emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
        >
          <TileGrid tiles={qualityTiles} labelFor={labelFor} />
        </SectionShell>
      ) : null}

      {exceptionsTiles.length > 0 ? (
        <SectionShell
          title={tCommon('mgmtSectionExceptions')}
          hint={tCommon('mgmtSectionExceptionsHint')}
        >
          <TileGrid tiles={exceptionsTiles} labelFor={labelFor} />
        </SectionShell>
      ) : null}

      {data.workers ? (
        <SectionShell
          title={tCommon('mgmtSectionWorkers')}
          hint={tCommon('mgmtSectionWorkersHint')}
        >
          <p className="text-sm text-text-secondary">
            {tCommon('mgmtWorkersSummary', {
              working: data.workers.workingToday,
              assigned: data.workers.assigned,
              unassigned: data.workers.unassigned,
              conflicts: data.workers.conflicts,
            })}
          </p>
        </SectionShell>
      ) : null}

      {data.manufacturing ? (
        <SectionShell
          title={tCommon('mgmtSectionManufacturing')}
          hint={tCommon('mgmtSectionManufacturingHint')}
        >
          <div className="maher-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={tCommon('mgmtMfgFinalOrders')}
              value={
                <span dir="ltr">
                  {data.manufacturing.finalCostOrders} ·{' '}
                  {money(data.manufacturing.finalCostTotal, currency)}
                </span>
              }
              icon={<Factory className="h-4 w-4" />}
              tone="brand"
            />
            <MetricCard
              label={tCommon('mgmtMfgIncomplete')}
              value={<AnimatedValue value={data.manufacturing.incompleteCosting} enabled />}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone={data.manufacturing.incompleteCosting > 0 ? 'warning' : 'success'}
            />
            {data.manufacturing.grossMfgDifference != null ? (
              <MetricCard
                label={tCommon('mgmtMfgGrossDiff')}
                value={
                  <span dir="ltr">{money(data.manufacturing.grossMfgDifference, currency)}</span>
                }
                icon={<Banknote className="h-4 w-4" />}
                tone="info"
              />
            ) : null}
          </div>
        </SectionShell>
      ) : null}

      {/* 7. Money — hidden when finance is null */}
      {data.finance ? (
        <SectionShell title={tCommon('mgmtSectionMoney')} hint={tCommon('mgmtSectionMoneyHint')}>
          <div className="space-y-4">
            <div className="maher-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={tCommon('metricReceivables')}
                value={<span dir="ltr">{money(data.finance.receivable, currency)}</span>}
                icon={<Banknote className="h-4 w-4" />}
                tone="brand"
              />
              <MetricCard
                label={tCommon('mgmtFinanceOverdue')}
                value={<span dir="ltr">{money(data.finance.overdue, currency)}</span>}
                icon={<AlertTriangle className="h-4 w-4" />}
                tone={data.finance.overdue > 0 ? 'error' : 'success'}
              />
              <MetricCard
                label={tCommon('mgmtFinanceAccountCredit')}
                value={<span dir="ltr">{money(data.finance.accountCredit, currency)}</span>}
                icon={<Receipt className="h-4 w-4" />}
                tone="info"
              />
              <MetricCard
                label={tCommon('mgmtFinancePaymentsMonth')}
                value={<span dir="ltr">{money(data.finance.paymentsThisMonth, currency)}</span>}
                icon={<Banknote className="h-4 w-4" />}
                tone="success"
              />
            </div>
            <BentoMetricCard
              href={tileLink(data.finance.openInvoices.href, data.finance.openInvoices.filter)}
              label={labelFor(data.finance.openInvoices)}
              value={<AnimatedValue value={data.finance.openInvoices.count} enabled />}
              hint={money(data.finance.receivable, currency)}
              icon={<Banknote className="h-5 w-5" />}
              tone="accent"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
              LinkComponent={Link}
            />
            {data.finance.topOverdue?.length ? (
              <ul className="divide-y divide-border overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface shadow-card">
                {data.finance.topOverdue.map((row) => (
                  <li key={row.customerId}>
                    <Link
                      href={row.href}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60"
                    >
                      <span className="text-sm font-medium text-text-primary">{row.name}</span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--maher-error)]" dir="ltr">
                        {money(row.amount, currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </SectionShell>
      ) : null}

      {/* 8. Activity */}
      <SectionShell
        title={tCommon('mgmtSectionActivity')}
        hint={tCommon('mgmtSectionActivityHint')}
        empty={activityEmpty}
        emptyLabel={tCommon('mgmtSectionEmptyHealthy')}
      >
        <ActivityList items={data.activity} emptyLabel={tCommon('mgmtSectionEmptyHealthy')} />
      </SectionShell>

      {/* Quick jumps */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">
          {tCommon('quickActions')}
        </h2>
        <div className="maher-stagger flex flex-wrap gap-2">
          {(
            [
              { href: '/production', label: tNav('production'), icon: Factory },
              { href: '/inventory', label: tNav('inventory'), icon: Boxes },
              { href: '/deliveries', label: tNav('deliveries'), icon: Truck },
              { href: '/quality', label: tNav('quality'), icon: PackageCheck },
              { href: '/returns', label: tNav('returns'), icon: RotateCcw },
              { href: '/reports', label: tNav('reports'), icon: ClipboardList },
            ] as Array<{ href: string; label: string; icon: LucideIcon }>
          ).map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="maher-press inline-flex items-center gap-2 rounded-[var(--maher-radius-lg)] border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary shadow-card hover:border-brand/35"
              >
                <Icon className="h-4 w-4 text-brand" />
                {a.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
