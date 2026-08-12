'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  addDays,
  endOfMonth,
  fmtTime,
  isSameDay,
  startOfMonth,
  startOfWeek,
  ymd,
  type CapacityRow,
  type ScheduleOrderCard,
  type SchedulingDashboard,
} from '@/lib/scheduling';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Ltr,
  PageHero,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListTodo,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type ReactNode } from 'react';

type ViewMode = 'day' | 'week' | 'month' | 'capacity';
type FocusFilter = 'all' | 'today' | 'week' | 'approvals' | 'alerts';

interface CalendarApiShape {
  orders?: ScheduleOrderCard[];
  data?: ScheduleOrderCard[];
}

interface CapacityApiShape {
  departments?: CapacityRow[];
  data?: CapacityRow[];
}

function normalizeOrders(raw: unknown): ScheduleOrderCard[] {
  if (Array.isArray(raw)) return raw as ScheduleOrderCard[];
  const shaped = raw as CalendarApiShape | null | undefined;
  return shaped?.orders ?? shaped?.data ?? [];
}

function normalizeDepartments(raw: unknown): CapacityRow[] {
  if (Array.isArray(raw)) return raw as CapacityRow[];
  const shaped = raw as CapacityApiShape | null | undefined;
  return shaped?.departments ?? shaped?.data ?? [];
}

function isPromiseAtRisk(order: ScheduleOrderCard) {
  return order.promiseState === 'AT_RISK' || Boolean(order.hasConflict);
}

function isApprovalWaiting(order: ScheduleOrderCard) {
  return order.status === 'PROPOSED' || order.status === 'NEEDS_REVIEW';
}

function departmentLabel(locale: string, row: CapacityRow) {
  if (locale === 'ar') return row.nameAr || row.nameEn || row.code || '—';
  if (locale === 'he') return row.nameHe || row.nameEn || row.code || '—';
  return row.nameEn || row.nameAr || row.code || '—';
}

function SummaryCard({
  icon,
  label,
  value,
  active,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  active: boolean;
  tone: 'brand' | 'info' | 'warning' | 'error';
  onClick: () => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    brand: 'text-brand bg-[var(--maher-brand-soft)]',
    info: 'text-[var(--maher-info)] bg-[var(--maher-info-soft)]',
    warning: 'text-[var(--maher-warning)] bg-[var(--maher-warning-soft)]',
    error: 'text-[var(--maher-error)] bg-[var(--maher-error-soft)]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`maher-lift group relative overflow-hidden rounded-[var(--maher-radius-lg)] border p-4 text-start shadow-[var(--maher-shadow-sm)] transition ${
        active ? 'border-brand/50 bg-[var(--maher-brand-soft)]/40' : 'border-border bg-surface hover:border-border-strong'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--maher-radius-md)] ${toneClasses[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-text-primary" dir="ltr">
        {value}
      </p>
    </button>
  );
}

function ScheduleCard({
  order,
  locale,
  openLabel,
  approveLabel,
  recalculateLabel,
  conflictLabel,
  qtyLabel,
  onApprove,
  onRecalculate,
  approving,
  recalculating,
  canApprove,
}: {
  order: ScheduleOrderCard;
  locale: string;
  openLabel: string;
  approveLabel: string;
  recalculateLabel: string;
  conflictLabel: string;
  qtyLabel: string;
  onApprove: () => void;
  onRecalculate: () => void;
  approving: boolean;
  recalculating: boolean;
  canApprove: boolean;
}) {
  const productLabel = localizedName(
    locale,
    { nameEn: order.productName, nameAr: order.productNameAr, nameHe: order.productNameHe },
    order.productName ?? '—',
  );
  const dealerLabel = order.dealerName
    ? localizedName(
        locale,
        { nameEn: order.dealerName, nameAr: order.dealerNameAr, nameHe: order.dealerNameHe },
        order.dealerName,
      )
    : null;
  return (
    <div className="maher-list-card space-y-1.5 rounded-lg border border-border bg-surface p-2.5 text-xs transition hover:border-brand/40 hover:shadow-sm">
      <div className="flex items-center justify-between gap-1.5">
        <Ltr className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          {order.number}
        </Ltr>
        {order.hasConflict ? (
          <Badge variant="error" className="shrink-0 scale-90 px-1.5 py-0">
            <AlertTriangle className="h-3 w-3" />
            {conflictLabel}
          </Badge>
        ) : null}
      </div>
      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary">
        {productLabel}
      </p>
      {dealerLabel ? <p className="truncate text-text-secondary">{dealerLabel}</p> : null}
      <div className="flex flex-wrap items-center gap-1">
        {order.status ? <StatusBadge status={order.status} /> : null}
        {order.priority ? <StatusBadge status={order.priority} /> : null}
      </div>
      {order.plannedStart || order.plannedEnd ? (
        <p className="text-text-tertiary" dir="ltr">
          {order.plannedStart ? fmtTime(order.plannedStart) : '—'}
          {order.plannedEnd ? ` – ${fmtTime(order.plannedEnd)}` : ''}
        </p>
      ) : null}
      {order.quantity != null ? (
        <p className="text-text-tertiary">
          {qtyLabel}: <span dir="ltr">{order.quantity}</span>
        </p>
      ) : null}
      <div className="maher-card-rule-t flex flex-wrap items-center gap-2 pt-1.5">
        <Link
          href={`/production/${order.productionOrderId}`}
          className="font-semibold text-brand hover:underline"
        >
          {openLabel}
        </Link>
        {canApprove ? (
          <button
            type="button"
            disabled={approving}
            onClick={onApprove}
            className="font-semibold text-[var(--maher-success)] hover:underline disabled:opacity-50"
          >
            {approveLabel}
          </button>
        ) : null}
        <button
          type="button"
          disabled={recalculating}
          onClick={onRecalculate}
          className="font-semibold text-text-secondary hover:underline disabled:opacity-50"
        >
          {recalculateLabel}
        </button>
      </div>
    </div>
  );
}

function SchedulingPageInner() {
  const t = useTranslations('navigation');
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>(() => {
    const fromUrl = searchParams.get('view');
    if (fromUrl === 'day' || fromUrl === 'week' || fromUrl === 'month' || fromUrl === 'capacity') {
      return fromUrl;
    }
    return 'week';
  });
  const [anchor, setAnchor] = useState(() => new Date());
  const [focus, setFocus] = useState<FocusFilter>('all');
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor };
    if (view === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    const start = startOfWeek(anchor);
    return { from: start, to: addDays(start, 6) };
  }, [view, anchor]);

  const fromParam = ymd(range.from);
  const toParam = ymd(range.to);

  const calendarQuery = useQuery({
    queryKey: ['scheduling-calendar', fromParam, toParam],
    queryFn: () =>
      apiFetch<unknown>(`/api/v1/scheduling/calendar?from=${fromParam}&to=${toParam}`).then(
        normalizeOrders,
      ),
    enabled: view !== 'capacity',
    retry: false,
  });

  const capacityQuery = useQuery({
    queryKey: ['scheduling-capacity', fromParam, toParam],
    queryFn: () =>
      apiFetch<unknown>(`/api/v1/scheduling/capacity?from=${fromParam}&to=${toParam}`).then(
        normalizeDepartments,
      ),
    enabled: view === 'capacity',
    retry: false,
  });

  const dashboardQuery = useQuery({
    queryKey: ['scheduling-dashboard'],
    queryFn: () => apiFetch<SchedulingDashboard>('/api/v1/scheduling/dashboard'),
    retry: false,
    refetchInterval: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      apiFetch(`/api/v1/scheduling/orders/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ version }),
      }),
    onSuccess: async () => {
      setError(null);
      setBanner(tp('scheduleApproved'));
      await qc.invalidateQueries({ queryKey: ['scheduling-calendar'] });
      await qc.invalidateQueries({ queryKey: ['scheduling-dashboard'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const recalculateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/scheduling/orders/${id}/recalculate`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      setError(null);
      setBanner(tp('scheduleRecalculated'));
      await qc.invalidateQueries({ queryKey: ['scheduling-calendar'] });
      await qc.invalidateQueries({ queryKey: ['scheduling-dashboard'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const recalculateRangeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiFetch(`/api/v1/scheduling/orders/${id}/recalculate`, {
          method: 'POST',
          body: '{}',
        });
      }
    },
    onSuccess: async () => {
      setError(null);
      setBanner(tp('scheduleRecalculated'));
      await qc.invalidateQueries({ queryKey: ['scheduling-calendar'] });
      await qc.invalidateQueries({ queryKey: ['scheduling-dashboard'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const filteredOrders = useMemo(() => {
    const orders = calendarQuery.data ?? [];
    if (focus === 'approvals') return orders.filter(isApprovalWaiting);
    if (focus === 'alerts') return orders.filter(isPromiseAtRisk);
    return orders;
  }, [calendarQuery.data, focus]);

  const dashboard = dashboardQuery.data;

  function goToday() {
    setAnchor(new Date());
  }

  function step(direction: 1 | -1) {
    if (view === 'day') {
      setAnchor((d) => addDays(d, direction));
    } else if (view === 'month') {
      setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
    } else {
      setAnchor((d) => addDays(d, direction * 7));
    }
  }

  const rangeLabel =
    view === 'day'
      ? ymd(anchor)
      : view === 'month'
        ? anchor.toLocaleDateString(locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en', {
            month: 'long',
            year: 'numeric',
          })
        : `${ymd(range.from)} — ${ymd(range.to)}`;

  const viewTabs: Array<{ key: ViewMode; label: string; icon: ReactNode }> = [
    { key: 'day', label: tp('viewDay'), icon: <Sun className="h-4 w-4" /> },
    { key: 'week', label: tp('viewWeek'), icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'month', label: tp('viewMonth'), icon: <CalendarRange className="h-4 w-4" /> },
    { key: 'capacity', label: tp('viewCapacity'), icon: <Gauge className="h-4 w-4" /> },
  ];

  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
    return [];
  }, [view, anchor, range.from]);

  const weekdayFormatter = new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en',
    { weekday: 'short' },
  );

  const monthWeeks = useMemo(() => {
    if (view !== 'month') return [];
    const first = startOfWeek(startOfMonth(anchor));
    const weeks: Date[][] = [];
    let cursor = first;
    for (let w = 0; w < 6; w++) {
      const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
      weeks.push(week);
      cursor = addDays(cursor, 7);
      if (cursor > endOfMonth(anchor) && w >= 3) break;
    }
    return weeks;
  }, [view, anchor]);

  function ordersForDay(day: Date) {
    return filteredOrders.filter((o) => {
      const d = o.plannedStart ? new Date(o.plannedStart) : null;
      return d && isSameDay(d, day);
    });
  }

  const unscheduled = useMemo(
    () => filteredOrders.filter((o) => !o.plannedStart),
    [filteredOrders],
  );

  const focusFilterLabel =
    focus === 'today'
      ? tp('focusFilterToday')
      : focus === 'week'
        ? tp('focusFilterWeek')
        : focus === 'approvals'
          ? tp('focusFilterApprovals')
          : focus === 'alerts'
            ? tp('focusFilterAlerts')
            : '';

  return (
    <div className="space-y-6">
      <PageHero title={t('scheduling')} description={tp('schedulingSubtitle')} tone="soft" />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="maher-stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={<Sun className="h-4 w-4" />}
          label={tp('dashboardToday')}
          value={dashboard?.todayCount ?? 0}
          tone="brand"
          active={focus === 'today'}
          onClick={() => {
            setView('day');
            setAnchor(new Date());
            setFocus('today');
          }}
        />
        <SummaryCard
          icon={<CalendarDays className="h-4 w-4" />}
          label={tp('dashboardWeek')}
          value={dashboard?.weekCount ?? 0}
          tone="info"
          active={focus === 'week'}
          onClick={() => {
            setView('week');
            setAnchor(new Date());
            setFocus('week');
          }}
        />
        <SummaryCard
          icon={<ListTodo className="h-4 w-4" />}
          label={tp('dashboardApprovalsWaiting')}
          value={dashboard?.approvalsWaiting ?? 0}
          tone="warning"
          active={focus === 'approvals'}
          onClick={() => {
            setView('week');
            setFocus('approvals');
          }}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label={tp('dashboardAlerts')}
          value={dashboard?.alerts ?? 0}
          tone="error"
          active={focus === 'alerts'}
          onClick={() => {
            setView('week');
            setFocus('alerts');
          }}
        />
      </div>
      {dashboardQuery.isError ? (
        <p className="text-xs text-text-tertiary">{tp('schedulingUnavailableHint')}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={tp('schedulingTitle')} className="flex flex-wrap gap-2">
          {viewTabs.map((tab) => {
            const selected = tab.key === view;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setView(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  selected
                    ? 'border-brand bg-[var(--maher-brand-soft)] text-brand'
                    : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {view !== 'capacity' ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => step(-1)} aria-label={tCommon('previous')}>
              <ChevronRight className="h-4 w-4 rtl:hidden" />
              <ChevronLeft className="hidden h-4 w-4 rtl:block" />
            </Button>
            <span className="min-w-[9rem] text-center text-sm font-medium text-text-primary" dir="ltr">
              {rangeLabel}
            </span>
            <Button size="sm" variant="ghost" onClick={() => step(1)} aria-label={tCommon('next')}>
              <ChevronLeft className="h-4 w-4 rtl:hidden" />
              <ChevronRight className="hidden h-4 w-4 rtl:block" />
            </Button>
            <Button size="sm" variant="secondary" onClick={goToday}>
              {tp('viewToday')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
              loading={recalculateRangeMutation.isPending}
              disabled={filteredOrders.length === 0}
              onClick={() =>
                recalculateRangeMutation.mutate(filteredOrders.map((o) => o.productionOrderId))
              }
            >
              {tp('recalculate')}
            </Button>
          </div>
        ) : null}
      </div>

      {focus !== 'all' && view !== 'capacity' ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-[var(--maher-brand-soft)] px-3 py-1.5 text-sm text-brand">
          <span>{focusFilterLabel}</span>
          <button
            type="button"
            onClick={() => setFocus('all')}
            className="ms-1 text-xs font-semibold underline"
          >
            {tp('clearFilter')}
          </button>
        </div>
      ) : null}

      {view === 'capacity' ? (
        capacityQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : capacityQuery.isError ? (
          <EmptyState
            title={tp('schedulingUnavailable')}
            description={tp('schedulingUnavailableHint')}
            action={
              <Button variant="secondary" onClick={() => capacityQuery.refetch()}>
                {tCommon('retry')}
              </Button>
            }
          />
        ) : (capacityQuery.data ?? []).length === 0 ? (
          <EmptyState title={tp('noCapacityData')} description={tp('capacityHint')} />
        ) : (
          <div className="maher-stagger space-y-3">
            {(capacityQuery.data ?? []).map((row) => {
              const pct =
                row.capacityMinutes > 0
                  ? Math.min(100, Math.round((row.bookedMinutes / row.capacityMinutes) * 100))
                  : 0;
              const tone = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success';
              const barColor =
                tone === 'error'
                  ? 'bg-[var(--maher-error)]'
                  : tone === 'warning'
                    ? 'bg-[var(--maher-warning)]'
                    : 'bg-[var(--maher-success)]';
              return (
                <div
                  key={row.departmentId}
                  className="maher-list-card rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-text-primary">{departmentLabel(locale, row)}</p>
                    <span className="text-sm font-semibold tabular-nums text-text-secondary" dir="ltr">
                      {Math.round(row.bookedMinutes / 60)}h / {Math.round(row.capacityMinutes / 60)}h · {pct}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[var(--maher-surface-muted)]">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : calendarQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : calendarQuery.isError ? (
        <EmptyState
          title={tp('schedulingUnavailable')}
          description={tp('schedulingUnavailableHint')}
          action={
            <Button variant="secondary" onClick={() => calendarQuery.refetch()}>
              {tCommon('retry')}
            </Button>
          }
        />
      ) : view === 'month' ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-[var(--maher-surface-muted)] text-center text-xs font-semibold text-text-secondary">
            {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)).map((d) => (
              <div key={d.toISOString()} className="py-2">
                {weekdayFormatter.format(d)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthWeeks.flat().map((day) => {
              const dayOrders = ordersForDay(day);
              const inMonth = day.getMonth() === anchor.getMonth();
              const hasConflict = dayOrders.some((o) => o.hasConflict);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    setAnchor(day);
                    setView('day');
                  }}
                  className={`flex min-h-[84px] flex-col items-start gap-1 border-b border-e border-border p-2 text-start transition hover:bg-[var(--maher-surface-muted)] ${
                    inMonth ? 'bg-surface' : 'bg-[var(--maher-surface-muted)]/40 text-text-tertiary'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      isSameDay(day, new Date()) ? 'rounded-full bg-brand px-1.5 py-0.5 text-white' : ''
                    }`}
                    dir="ltr"
                  >
                    {day.getDate()}
                  </span>
                  {dayOrders.length > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        hasConflict
                          ? 'bg-[var(--maher-error-soft)] text-[var(--maher-error)]'
                          : 'bg-[var(--maher-brand-soft)] text-brand'
                      }`}
                    >
                      {hasConflict ? <AlertTriangle className="h-3 w-3" /> : null}
                      {dayOrders.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState title={tp('calendarEmpty')} description={tp('schedulingSubtitle')} />
      ) : (
        <div
          className={`grid gap-3 ${view === 'day' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'}`}
        >
          {days.map((day) => {
            const dayOrders = ordersForDay(day);
            return (
              <div key={day.toISOString()} className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-[var(--maher-surface-muted)] px-2.5 py-1.5">
                  <span className="text-xs font-semibold text-text-secondary">
                    {weekdayFormatter.format(day)}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      isSameDay(day, new Date()) ? 'text-brand' : 'text-text-tertiary'
                    }`}
                    dir="ltr"
                  >
                    {ymd(day)}
                  </span>
                </div>
                <div className="space-y-2">
                  {dayOrders.length === 0 ? (
                    <p className="px-1 text-[11px] text-text-tertiary">{tCommon('emptyList')}</p>
                  ) : (
                    dayOrders.map((order) => (
                      <ScheduleCard
                        key={order.id}
                        order={order}
                        locale={locale}
                        openLabel={tCommon('details')}
                        approveLabel={tp('approve')}
                        recalculateLabel={tp('recalculate')}
                        conflictLabel={tp('conflict')}
                        qtyLabel={tc('qty')}
                        canApprove={order.status === 'PROPOSED' || order.status === 'NEEDS_REVIEW'}
                        approving={
                          approveMutation.isPending && approveMutation.variables?.id === order.productionOrderId
                        }
                        recalculating={
                          recalculateMutation.isPending &&
                          recalculateMutation.variables === order.productionOrderId
                        }
                        onApprove={() =>
                          approveMutation.mutate({
                            id: order.productionOrderId,
                            version: order.version ?? 1,
                          })
                        }
                        onRecalculate={() => recalculateMutation.mutate(order.productionOrderId)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {unscheduled.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-[var(--maher-warning-soft)] px-2.5 py-1.5">
                <span className="text-xs font-semibold text-[var(--maher-warning)]">
                  {tp('unscheduled')}
                </span>
                <span className="text-xs font-semibold tabular-nums text-[var(--maher-warning)]">
                  {unscheduled.length}
                </span>
              </div>
              <div className="space-y-2">
                {unscheduled.map((order) => (
                  <ScheduleCard
                    key={order.id}
                    order={order}
                    locale={locale}
                    openLabel={tCommon('details')}
                    approveLabel={tp('approve')}
                    recalculateLabel={tp('recalculate')}
                    conflictLabel={tp('conflict')}
                    qtyLabel={tc('qty')}
                    canApprove={order.status === 'PROPOSED' || order.status === 'NEEDS_REVIEW'}
                    approving={
                      approveMutation.isPending && approveMutation.variables?.id === order.productionOrderId
                    }
                    recalculating={
                      recalculateMutation.isPending &&
                      recalculateMutation.variables === order.productionOrderId
                    }
                    onApprove={() =>
                      approveMutation.mutate({ id: order.productionOrderId, version: order.version ?? 1 })
                    }
                    onRecalculate={() => recalculateMutation.mutate(order.productionOrderId)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SchedulingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SchedulingPageInner />
    </Suspense>
  );
}
