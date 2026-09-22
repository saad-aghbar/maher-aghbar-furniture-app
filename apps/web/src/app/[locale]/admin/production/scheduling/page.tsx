'use client';

import { DayExceptionDialog, type DayExceptionKind } from '@/components/scheduling/day-exception-dialog';
import { ApproveScheduleDialog, ChangeDateDialog, RecalculateScheduleDialog } from '@/components/scheduling/schedule-action-dialogs';
import { ScheduleOrderRow } from '@/components/scheduling/schedule-order-row';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useAuthMe } from '@/hooks/use-auth-me';
import { apiFetch } from '@/lib/api-client';
import type { AtRiskOrder, CalendarResponse, CapacityRow, ProductionScheduleDetail, SchedulingDashboard } from '@/lib/scheduling';
import {
  filterScheduleCards,
  formatYmdLabel,
  monthRangeYmd,
  selectApprovalsWaiting,
  selectAtRiskCards,
  selectConflictCards,
  selectDashboardStats,
  selectMonthDayMeta,
  selectOrdersForDay,
  selectOrdersInRange,
  todayYmd,
  weekRangeFromYmd,
  type AdminScheduleActionMode,
  type AdminScheduleCardModel,
  type ScheduleFocusKey,
} from '@/lib/scheduling-board';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { Board, BoardSkeleton, Button, CalendarLegend, ConfirmDialog, ErrorBoard, Figure, Input, Ltr, Meter, MonthCalendar, Ribbon, Stamp, StatusChips, Ticket, useToast, type BoardTone, type DayMeta } from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, RefreshCw, Settings2, Wand2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type Focus = ScheduleFocusKey | 'unscheduled';
type Summary = { today: number; thisWeek: number; unscheduled: number; atRisk: number; conflicts: number; overtime: number; timezone: string; todayYmd: string; weekFrom: string; weekTo: string };
type ConflictSide = { allocationId: string; productionOrderId: string; orderNumber: string; productName: string | null; stageName: string | null; start: string; end: string; priority: string; isPinned: boolean };
type ScheduleConflict = { conflictId: string; type: string; worker: { id: string; name: string } | null; resource: { stageDefinitionId: string; stageName: string | null; slot: number } | null; overlapStart: string; overlapEnd: string; overlapMinutes: number; allocationA: ConflictSide; allocationB: ConflictSide };
type ConflictsResponse = { data: ScheduleConflict[]; count: number; affectedOrderCount: number };
type UnscheduledOrder = { id: string; number: string; status: string; productDescription: string; requiredDeliveryDate?: string | null; priority?: string | null; planningState?: string; dealerName?: string | null; salesOrderNumber?: string | null; product?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null; imageUrl?: string | null } | null };

function normalizeCalendar(raw: unknown): CalendarResponse {
  if (!raw || typeof raw !== 'object') return { calendar: null, days: [], orders: [] };
  const shaped = raw as CalendarResponse & { data?: CalendarResponse['orders'] };
  return { calendar: shaped.calendar ?? null, days: Array.isArray(shaped.days) ? shaped.days : [], orders: Array.isArray(shaped.orders) ? shaped.orders : Array.isArray(shaped.data) ? shaped.data : [] };
}
const normalizeDepartments = (raw: unknown): CapacityRow[] => (Array.isArray(raw) ? (raw as CapacityRow[]) : ((raw as { departments?: CapacityRow[]; data?: CapacityRow[] } | null)?.departments ?? (raw as { data?: CapacityRow[] } | null)?.data ?? []));
const normalizeAtRisk = (raw: unknown): AtRiskOrder[] => (Array.isArray(raw) ? (raw as AtRiskOrder[]) : ((raw as { data?: AtRiskOrder[] } | null)?.data ?? []));

export default function SchedulingPage() {
  const t = useTranslations('mobile.adminScheduling');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useAuthMe();
  const canManage = can(me.data, 'schedule.manage');

  const today = todayYmd();
  const weekRange = useMemo(() => weekRangeFromYmd(today), [today]);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState(today);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState<AdminScheduleCardModel | null>(null);
  const [dialog, setDialog] = useState<'approve' | 'changeDate' | 'recalculate' | 'dayException' | 'resolveConflicts' | 'resolveAtRisk' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthRange = useMemo(() => monthRangeYmd(cursor.y, cursor.m), [cursor]);
  const needsWeek = focus === 'today' || focus === 'week';

  const dashboard = useQuery({ queryKey: ['scheduling-dashboard'], queryFn: () => apiFetch<SchedulingDashboard>('/api/v1/scheduling/dashboard'), retry: false, refetchInterval: 60_000, placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ['scheduling-summary'], queryFn: () => apiFetch<Summary>('/api/v1/scheduling/summary'), retry: false, refetchInterval: 60_000, placeholderData: keepPreviousData });
  const calendar = useQuery({ queryKey: ['scheduling-calendar', monthRange.from, monthRange.to], queryFn: () => apiFetch<unknown>(`/api/v1/scheduling/calendar?from=${monthRange.from}&to=${monthRange.to}&view=month`).then(normalizeCalendar), retry: false, placeholderData: keepPreviousData });
  const weekCalendar = useQuery({ queryKey: ['scheduling-calendar', weekRange.from, weekRange.to, 'week'], queryFn: () => apiFetch<unknown>(`/api/v1/scheduling/calendar?from=${weekRange.from}&to=${weekRange.to}&view=week`).then(normalizeCalendar), enabled: needsWeek, retry: false, placeholderData: keepPreviousData });
  const atRiskQ = useQuery({ queryKey: ['scheduling-at-risk'], queryFn: () => apiFetch<unknown>('/api/v1/scheduling/at-risk').then(normalizeAtRisk), retry: false, placeholderData: keepPreviousData });
  const capacity = useQuery({ queryKey: ['scheduling-capacity', monthRange.from, monthRange.to], queryFn: () => apiFetch<unknown>(`/api/v1/scheduling/capacity?from=${monthRange.from}&to=${monthRange.to}`).then(normalizeDepartments), retry: false, placeholderData: keepPreviousData });
  const conflicts = useQuery({ queryKey: ['scheduling-conflicts'], queryFn: () => apiFetch<ConflictsResponse>('/api/v1/scheduling/conflicts'), retry: false, placeholderData: keepPreviousData });
  const unscheduled = useQuery({ queryKey: ['scheduling-unscheduled'], queryFn: () => apiFetch<UnscheduledOrder[] | { data: UnscheduledOrder[] }>('/api/v1/scheduling/unscheduled').then((r) => (Array.isArray(r) ? r : r.data)), retry: false, placeholderData: keepPreviousData });

  const stats = useMemo(() => selectDashboardStats(dashboard.data), [dashboard.data]);
  const monthMeta = useMemo(() => selectMonthDayMeta(calendar.data?.days, calendar.data?.orders), [calendar.data]);
  const conflictDays = useMemo(() => new Set((conflicts.data?.data ?? []).map((c) => c.overlapStart.slice(0, 10))), [conflicts.data]);
  const exceptionByDay = useMemo(() => new Map((calendar.data?.calendar?.exceptions ?? []).map((ex) => [String(ex.date).slice(0, 10), ex])), [calendar.data]);
  const dayMeta = useMemo<Record<string, DayMeta>>(() => {
    const out: Record<string, DayMeta> = {};
    const maxCount = Math.max(1, ...Object.values(monthMeta).map((m) => m.orderCount));
    for (const [ymd, m] of Object.entries(monthMeta)) {
      const ex = exceptionByDay.get(ymd);
      out[ymd] = {
        tone: !m.isWorking ? 'closed' : m.orderCount === 0 ? 'empty' : m.load === 'busy' ? 'busy' : m.load === 'half' ? 'half' : 'light',
        density: m.density,
        count: m.orderCount,
        loadPercent: m.isWorking && m.orderCount > 0 ? Math.round((m.orderCount / maxCount) * 100) : null,
        overtime: ex?.type === 'EXTRA_SHIFT',
        conflict: conflictDays.has(ymd),
        markers: conflictDays.has(ymd) ? ['attention'] : undefined,
      };
    }
    return out;
  }, [monthMeta, conflictDays, exceptionByDay]);

  const dayOrders = useMemo(() => selectOrdersForDay(calendar.data?.orders, selectedDay, locale), [calendar.data?.orders, locale, selectedDay]);
  const selectedDayInfo = monthMeta[selectedDay];
  const calendarMeta = calendar.data?.calendar;
  const atRisk = useMemo(() => selectAtRiskCards(atRiskQ.data, locale), [atRiskQ.data, locale]);
  const focusSource = useMemo(() => {
    const monthOrders = calendar.data?.orders ?? [];
    const weekOrders = weekCalendar.data?.orders ?? [];
    const byId = new Map<string, (typeof monthOrders)[number]>();
    for (const o of [...monthOrders, ...weekOrders]) byId.set(o.productionOrderId, o);
    return [...byId.values()];
  }, [calendar.data?.orders, weekCalendar.data?.orders]);
  const focusCards = useMemo(() => {
    if (!focus || focus === 'unscheduled') return [];
    if (focus === 'today') return selectOrdersForDay(focusSource, today, locale);
    if (focus === 'week') return selectOrdersInRange(focusSource, weekRange.from, weekRange.to, locale);
    if (focus === 'awaitingApproval') return selectApprovalsWaiting(focusSource, locale);
    if (focus === 'atRisk') return atRisk;
    return selectConflictCards(focusSource, locale);
  }, [atRisk, focus, focusSource, locale, today, weekRange.from, weekRange.to]);
  const visibleCards = useMemo(() => filterScheduleCards(focus && focus !== 'unscheduled' ? focusCards : dayOrders, orderSearch), [focus, focusCards, dayOrders, orderSearch]);

  const weekStrip = useMemo(() => {
    const days: string[] = [];
    const start = new Date(`${weekRange.from}T00:00:00`);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return days;
  }, [weekRange.from]);

  const invalidateBoard = () => Promise.all(['scheduling-calendar', 'scheduling-dashboard', 'scheduling-summary', 'scheduling-at-risk', 'scheduling-capacity', 'scheduling-conflicts', 'scheduling-unscheduled'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const jumpTo = (detail: ProductionScheduleDetail) => {
    const allocations = detail.schedule?.allocations ?? [];
    if (!allocations.length) return;
    const min = allocations.reduce((m, a) => (a.plannedStart < m ? a.plannedStart : m), allocations[0]!.plannedStart).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(min)) return;
    setFocus(null);
    setSelectedDay(min);
    const [y, m] = min.split('-').map(Number);
    if (y && m) setCursor({ y, m: m - 1 });
  };
  const onErr = (err: unknown) => setError(mutationErrorMessage(err, t('sheets.genericError')));

  const approve = useMutation({
    mutationFn: async (vars: { id: string; version: number }) => {
      let version = vars.version;
      try {
        const latest = await apiFetch<ProductionScheduleDetail>(`/api/v1/scheduling/orders/${vars.id}`);
        if (latest.schedule?.version != null) version = latest.schedule.version;
      } catch {
        /* keep card version */
      }
      return apiFetch(`/api/v1/scheduling/orders/${vars.id}/approve`, { method: 'POST', body: JSON.stringify({ version, idempotencyKey: `approve-${vars.id}-${Date.now()}` }) });
    },
    onSuccess: async () => {
      setError(null);
      setDialog(null);
      toast.success(t('sheets.approveSuccess'));
      await invalidateBoard();
    },
    onError: onErr,
  });
  const changeDate = useMutation({
    mutationFn: async (vars: { id: string; isoDate: string; reason?: string }) => {
      await apiFetch(`/api/v1/scheduling/orders/${vars.id}/dealer-date`, { method: 'POST', body: JSON.stringify({ requestedDeliveryDate: vars.isoDate, reason: vars.reason, idempotencyKey: `admin-date-${vars.id}-${Date.now()}` }) });
      return apiFetch<ProductionScheduleDetail>(`/api/v1/scheduling/orders/${vars.id}`);
    },
    onSuccess: async (detail) => {
      setError(null);
      setDialog(null);
      toast.success(t('sheets.changeDateSuccess'));
      jumpTo(detail);
      await invalidateBoard();
    },
    onError: onErr,
  });
  const recalculate = useMutation({
    mutationFn: async (vars: { id: string; reason?: string }) => {
      await apiFetch(`/api/v1/scheduling/orders/${vars.id}/recalculate`, { method: 'POST', body: JSON.stringify({ reason: vars.reason }) });
      return apiFetch<ProductionScheduleDetail>(`/api/v1/scheduling/orders/${vars.id}`);
    },
    onSuccess: async (detail) => {
      setError(null);
      setDialog(null);
      toast.success(t('sheets.recalculateSuccess'));
      jumpTo(detail);
      await invalidateBoard();
    },
    onError: onErr,
  });
  const recalculateAll = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => apiFetch(`/api/v1/scheduling/orders/${id}/recalculate`, { method: 'POST', body: '{}' })));
      return { ok: results.filter((r) => r.status === 'fulfilled').length, failed: results.filter((r) => r.status === 'rejected').length };
    },
    onSuccess: async ({ ok, failed }) => {
      toast.success(tp('recalculateAllResult', { ok, failed }));
      await invalidateBoard();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const resolveConflict = useMutation({
    mutationFn: (conflictId: string) => apiFetch<{ resolved: boolean; action: string }>(`/api/v1/scheduling/conflicts/${encodeURIComponent(conflictId)}/resolve`, { method: 'POST' }),
    onSuccess: async (res) => {
      toast.success(res.action === 'ALREADY_RESOLVED' ? t('conflicts.alreadyResolved') : t('conflicts.resolveSuccess'));
      await invalidateBoard();
    },
    onError: (err) => toast.error(mutationErrorMessage(err, t('conflicts.resolveFailed'))),
  });
  const resolveAllConflicts = useMutation({
    mutationFn: () => apiFetch<{ resolvedCount: number; failedCount: number; remainingConflictCount: number }>('/api/v1/scheduling/conflicts/resolve-all', { method: 'POST' }),
    onSuccess: async (res) => {
      setDialog(null);
      toast.success(res.failedCount || res.remainingConflictCount ? t('conflicts.resolvePartial', { ok: res.resolvedCount, fail: res.failedCount || res.remainingConflictCount }) : t('conflicts.resolveSuccess'));
      await invalidateBoard();
    },
    onError: (err) => toast.error(mutationErrorMessage(err, t('conflicts.resolveFailed'))),
  });
  const resolveAllAtRisk = useMutation({
    mutationFn: () => apiFetch<{ resolvedAutomatically: number; stillNeedsAttention: number; alreadyOnTrack: number }>('/api/v1/scheduling/at-risk/resolve-all', { method: 'POST' }),
    onSuccess: async (res) => {
      setDialog(null);
      toast.success(res.resolvedAutomatically ? `${t('atRisk.resolvedAutomatically')}: ${res.resolvedAutomatically} · ${t('atRisk.stillNeedsAttention')}: ${res.stillNeedsAttention}` : t('atRisk.resolveAllNeedsAdmin'));
      await invalidateBoard();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const dayException = useMutation({
    mutationFn: async (action: { kind: DayExceptionKind; overtimeEnd?: string }) => {
      if (action.kind === 'clear') return apiFetch(`/api/v1/scheduling/calendar-settings/exceptions/${encodeURIComponent(selectedDay)}`, { method: 'DELETE' });
      if (action.kind === 'close') return apiFetch('/api/v1/scheduling/calendar-settings/exceptions', { method: 'POST', body: JSON.stringify({ date: selectedDay, type: 'SHUTDOWN', note: 'Closed by admin' }) });
      if (action.kind === 'overtime') return apiFetch('/api/v1/scheduling/calendar-settings/exceptions', { method: 'POST', body: JSON.stringify({ date: selectedDay, type: 'EXTRA_SHIFT', shiftStart: calendarMeta?.shiftStart ?? '08:00', shiftEnd: action.overtimeEnd ?? '20:00', note: 'Overtime' }) });
      return apiFetch('/api/v1/scheduling/calendar-settings/exceptions', { method: 'POST', body: JSON.stringify({ date: selectedDay, type: 'EXTRA_SHIFT', shiftStart: calendarMeta?.shiftStart ?? '08:00', shiftEnd: calendarMeta?.shiftEnd ?? '16:00', note: 'Opened by admin' }) });
    },
    onSuccess: async () => {
      setError(null);
      setDialog(null);
      toast.success(tp('scheduleUpdated'));
      await invalidateBoard();
    },
    onError: onErr,
  });

  function onFocus(key: Focus) {
    setOrderSearch('');
    if (focus === key) return setFocus(null);
    setFocus(key);
    if (key === 'today' || key === 'week') {
      setCursor({ y: now.getFullYear(), m: now.getMonth() });
      setSelectedDay(today);
    }
  }
  function onRowAction(mode: AdminScheduleActionMode, card: AdminScheduleCardModel) {
    setSelectedCard(card);
    setError(null);
    setDialog(mode);
  }

  const s = summary.data;
  const statValue = (k: ScheduleFocusKey) => stats.find((x) => x.key === k)?.value ?? 0;
  const focusItems: Array<{ id: Focus; label: string; count: number; tone?: BoardTone }> = [
    { id: 'today', label: t('stats.today'), count: s?.today ?? statValue('today') },
    { id: 'week', label: t('stats.week'), count: s?.thisWeek ?? statValue('week') },
    { id: 'awaitingApproval', label: t('stats.awaitingApproval'), count: statValue('awaitingApproval'), tone: statValue('awaitingApproval') ? 'warning' : undefined },
    { id: 'unscheduled', label: t('stats.unscheduled'), count: s?.unscheduled ?? (unscheduled.data?.length ?? 0), tone: (s?.unscheduled ?? 0) ? 'warning' : undefined },
    { id: 'atRisk', label: t('stats.atRisk'), count: s?.atRisk ?? statValue('atRisk'), tone: (s?.atRisk ?? statValue('atRisk')) ? 'error' : undefined },
    { id: 'conflicts', label: t('stats.conflicts'), count: s?.conflicts ?? conflicts.data?.count ?? 0, tone: (s?.conflicts ?? conflicts.data?.count ?? 0) ? 'error' : undefined },
  ];
  const heroTone: BoardTone = (s?.conflicts ?? 0) > 0 || (s?.atRisk ?? 0) > 0 ? 'error' : (s?.unscheduled ?? 0) > 0 ? 'warning' : 'brand';
  const dayClosed = Boolean(selectedDayInfo && !selectedDayInfo.isWorking);
  const listTitle = focus && focus !== 'unscheduled' ? t(focus === 'today' ? 'stats.today' : focus === 'week' ? 'weekOrdersTitle' : focus === 'awaitingApproval' ? 'approvalsTitle' : focus === 'atRisk' ? 'atRiskTitle' : 'conflictsTitle') : t('dayOrdersTitle', { date: formatYmdLabel(selectedDay, locale) });
  const emptyTitle = orderSearch.trim() ? t('searchEmpty') : focus && focus !== 'unscheduled' ? t(focus === 'today' ? 'dayEmpty' : focus === 'week' ? 'weekOrdersEmpty' : focus === 'awaitingApproval' ? 'approvalsEmpty' : focus === 'atRisk' ? 'atRiskEmpty' : 'conflictsEmpty') : dayClosed ? t('dayClosed') : t('dayEmpty');
  const fmtTime = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const fmtDay = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={heroTone} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] xl:items-center">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)] rtl:tracking-normal">{t('eyebrow')}</p>
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('title')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{t('subtitle')}</p>
            {canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" leadingIcon={<RefreshCw className="h-3.5 w-3.5" />} loading={recalculateAll.isPending} disabled={visibleCards.length === 0} onClick={() => recalculateAll.mutate([...new Set(visibleCards.map((c) => c.productionOrderId))])}>
                  {tp('recalculateAll')}
                </Button>
                {(conflicts.data?.count ?? 0) > 0 ? (
                  <Button size="sm" variant="secondary" leadingIcon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => setDialog('resolveConflicts')}>
                    {t('conflicts.resolveAll')}
                  </Button>
                ) : null}
                {(s?.atRisk ?? atRisk.length) > 0 ? (
                  <Button size="sm" variant="secondary" leadingIcon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => setDialog('resolveAtRisk')}>
                    {t('atRisk.resolveAll')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{t('weekStripTitle')}</p>
            <Ribbon size="sm" legend={false} segments={weekStrip.map((d) => ({ key: d, label: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${d}T00:00:00`)), value: Math.max(0.2, monthMeta[d]?.orderCount ?? 0), tone: (monthMeta[d] && !monthMeta[d]!.isWorking ? 'neutral' : conflictDays.has(d) ? 'error' : (monthMeta[d]?.orderCount ?? 0) > 0 ? 'brand' : 'neutral') as BoardTone }))} />
            <div className="mt-1 grid grid-cols-7 text-center text-[11px] text-[var(--maher-text-tertiary)]">
              {weekStrip.map((d) => (
                <button key={d} type="button" className={`maher-press rounded-md py-1 ${d === selectedDay ? 'font-semibold text-[var(--maher-text-primary)]' : ''}`} onClick={() => (setFocus(null), setSelectedDay(d), setCursor({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 }))}>
                  <span className="block">{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${d}T00:00:00`))}</span>
                  <span className="block tabular-nums" dir="ltr">
                    {monthMeta[d]?.orderCount ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
              {focusItems.map((f) => (
                <Figure key={f.id} size="sm" value={f.count} label={f.label} tone={f.tone ?? 'neutral'} />
              ))}
            </div>
          </div>
        </div>
      </Board>

      <StatusChips aria-label={t('filters')} value={focus ?? 'none'} onChange={(id) => (id === 'none' ? setFocus(null) : onFocus(id as Focus))} items={[{ id: 'none', label: t('monthTitle') }, ...focusItems.map((f) => ({ id: f.id, label: f.label, count: f.count, tone: f.tone }))]} />

      {calendar.isError && !calendar.data ? (
        <ErrorBoard title={t('errorTitle')} description={t('errorBody')} onRetry={() => void calendar.refetch()} />
      ) : (
        <div className={focus ? 'grid gap-5' : 'grid items-start gap-5 xl:grid-cols-12'}>
          {!focus ? (
            <Board tone="brand" className="xl:col-span-7">
              <Board.Header
                title={t('monthTitle')}
                actions={
                  canManage ? (
                    <Button size="sm" variant="secondary" leadingIcon={<Settings2 className="h-3.5 w-3.5" />} onClick={() => (setError(null), setDialog('dayException'))}>
                      {t('dayCapacity.edit')}
                    </Button>
                  ) : null
                }
              />
              <div className="px-3 pb-3 pt-2">
                {calendar.isLoading && !calendar.data ? (
                  <BoardSkeleton header={false} rows={6} />
                ) : (
                  <MonthCalendar
                    variant="admin"
                    embedded
                    value={selectedDay}
                    onSelect={(ymd) => (setSelectedDay(ymd), setOrderSearch(''))}
                    monthCursor={cursor}
                    onMonthChange={(c) => {
                      setCursor(c);
                      const range = monthRangeYmd(c.y, c.m);
                      if (selectedDay < range.from || selectedDay > range.to) setSelectedDay(today >= range.from && today <= range.to ? today : range.from);
                    }}
                    dayMeta={dayMeta}
                    locale={locale}
                    footer={
                      <CalendarLegend
                        className="px-2 pt-2"
                        items={[
                          { id: 'light', label: t('legend.light'), swatch: 'light' },
                          { id: 'half', label: t('legend.half'), swatch: 'half' },
                          { id: 'busy', label: t('legend.busy'), swatch: 'busy' },
                          { id: 'closed', label: t('dayCapacity.statusClosed'), swatch: 'closed' },
                          { id: 'conflict', label: t('conflict'), swatch: 'attention' },
                        ]}
                      />
                    }
                  />
                )}
              </div>
            </Board>
          ) : null}

          {focus === 'unscheduled' ? (
            <UnscheduledBoard rows={unscheduled.data ?? []} loading={unscheduled.isLoading} locale={locale} />
          ) : focus === 'conflicts' ? (
            <Board tone="error" wash="top">
              <Board.Header title={t('conflicts.overlapTitle')} description={t('conflicts.caption')} meta={conflicts.data ? <Stamp tone="error" size="sm">{t('conflicts.affectingOrders', { conflicts: conflicts.data.count, orders: conflicts.data.affectedOrderCount })}</Stamp> : null} />
              {conflicts.isLoading ? (
                <BoardSkeleton header={false} rows={3} />
              ) : (conflicts.data?.data ?? []).length === 0 ? (
                <Board.Empty title={t('conflicts.overlapEmpty')} />
              ) : (
                <Board.Body className="grid gap-3 lg:grid-cols-2">
                  {(conflicts.data?.data ?? []).map((c) => (
                    <Ticket
                      key={c.conflictId}
                      tone="error"
                      title={c.worker ? t('conflicts.workerOverlap', { name: c.worker.name }) : c.resource?.stageName ?? t('conflicts.typeResource')}
                      why={`${fmtDay(c.overlapStart)} · ${t('conflicts.overlapWindow', { start: fmtTime(c.overlapStart), end: fmtTime(c.overlapEnd) })} · ${t('conflicts.overlapDuration', { hours: Math.floor(c.overlapMinutes / 60), minutes: c.overlapMinutes % 60 })}`}
                      action={
                        <span className="flex flex-col gap-1 text-[12px] text-[var(--maher-text-secondary)]">
                          <span>
                            <Ltr>{c.allocationA.orderNumber}</Ltr> · {c.allocationA.stageName ?? c.allocationA.productName ?? ''}
                          </span>
                          <span>
                            <Ltr>{c.allocationB.orderNumber}</Ltr> · {c.allocationB.stageName ?? c.allocationB.productName ?? ''}
                          </span>
                        </span>
                      }
                      trailing={
                        canManage ? (
                          <Button size="sm" variant="secondary" loading={resolveConflict.isPending && resolveConflict.variables === c.conflictId} onClick={() => resolveConflict.mutate(c.conflictId)}>
                            {t('conflicts.resolve')}
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
                </Board.Body>
              )}
              {visibleCards.length ? (
                <>
                  <Board.Header title={t('conflicts.ordersTitle')} description={t('conflicts.ordersCaption')} plain />
                  <ul className="divide-y divide-[var(--maher-border)]">
                    {visibleCards.map((card) => (
                      <ScheduleOrderRow key={card.id} card={card} onAction={onRowAction} />
                    ))}
                  </ul>
                </>
              ) : null}
            </Board>
          ) : (
            <Board tone={focus === 'atRisk' ? 'error' : focus === 'awaitingApproval' ? 'warning' : dayClosed ? 'neutral' : 'brand'} className={focus ? '' : 'xl:col-span-5'}>
              <Board.Header
                title={listTitle}
                description={!focus && dayClosed ? t('dayClosed') : focus === 'atRisk' ? t('atRisk.caption') : undefined}
                meta={visibleCards.length ? <Stamp tone="neutral" size="sm">{visibleCards.length}</Stamp> : null}
                actions={
                  !focus && selectedDayInfo ? (
                    <Stamp tone={dayClosed ? 'neutral' : 'success'} size="sm">
                      {dayClosed ? t('dayCapacity.statusClosed') : t('dayCapacity.statusOpen')}
                    </Stamp>
                  ) : null
                }
              />
              <div className="px-5 pb-3 pt-3">
                <Input withSearchIcon value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} />
              </div>
              {calendar.isLoading && !calendar.data && !focus ? (
                <BoardSkeleton header={false} rows={3} />
              ) : visibleCards.length === 0 ? (
                <Board.Empty title={emptyTitle} />
              ) : (
                <ul className="divide-y divide-[var(--maher-border)]">
                  {visibleCards.map((card) => (
                    <ScheduleOrderRow key={card.id} card={card} onAction={onRowAction} />
                  ))}
                </ul>
              )}
            </Board>
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone="info" className="xl:col-span-7">
          <Board.Header title={tp('capacityStrip')} description={tp('capacityHint')} meta={<Ltr className="text-[12px] text-[var(--maher-text-tertiary)]">{`${monthRange.from} – ${monthRange.to}`}</Ltr>} />
          {capacity.isLoading && !capacity.data ? (
            <BoardSkeleton header={false} rows={3} />
          ) : (capacity.data ?? []).length === 0 ? (
            <Board.Empty title={tp('capacityHint')} />
          ) : (
            <Board.Body className="space-y-3">
              {(capacity.data ?? []).map((row) => {
                const pct = row.capacityMinutes > 0 ? Math.round((row.bookedMinutes / row.capacityMinutes) * 100) : 0;
                return <Meter key={row.departmentId} value={Math.min(row.bookedMinutes, row.capacityMinutes * 1.25)} max={Math.max(1, row.capacityMinutes)} target={row.capacityMinutes} label={localizedName(locale, { nameEn: row.nameEn ?? row.code ?? '', nameAr: row.nameAr, nameHe: row.nameHe }, row.code ?? '—')} valueLabel={`${Math.round(row.bookedMinutes / 60)}h / ${Math.round(row.capacityMinutes / 60)}h · ${pct}%`} tone={pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success'} size="sm" />;
              })}
            </Board.Body>
          )}
        </Board>
        {focus !== 'unscheduled' ? <UnscheduledBoard rows={(unscheduled.data ?? []).slice(0, 6)} total={unscheduled.data?.length ?? 0} loading={unscheduled.isLoading} locale={locale} className="xl:col-span-5" onViewAll={() => onFocus('unscheduled')} /> : null}
      </div>

      <ApproveScheduleDialog open={dialog === 'approve'} card={selectedCard} loading={approve.isPending} error={dialog === 'approve' ? error : null} onClose={() => setDialog(null)} onConfirm={() => selectedCard && selectedCard.scheduleVersion != null && approve.mutate({ id: selectedCard.productionOrderId, version: selectedCard.scheduleVersion })} />
      <ChangeDateDialog open={dialog === 'changeDate'} card={selectedCard} loading={changeDate.isPending} error={dialog === 'changeDate' ? error : null} onClose={() => setDialog(null)} onSubmit={(isoDate, reason) => selectedCard && changeDate.mutate({ id: selectedCard.productionOrderId, isoDate, reason })} />
      <RecalculateScheduleDialog open={dialog === 'recalculate'} card={selectedCard} loading={recalculate.isPending} error={dialog === 'recalculate' ? error : null} onClose={() => setDialog(null)} onConfirm={(reason) => selectedCard && recalculate.mutate({ id: selectedCard.productionOrderId, reason })} />
      <DayExceptionDialog open={dialog === 'dayException'} onClose={() => setDialog(null)} dateYmd={selectedDay} isWorking={Boolean(selectedDayInfo?.isWorking)} hasException={exceptionByDay.has(selectedDay)} defaultShiftStart={calendarMeta?.shiftStart ?? '08:00'} defaultShiftEnd={calendarMeta?.shiftEnd ?? '16:00'} loading={dayException.isPending} errorMessage={dialog === 'dayException' ? error : null} onAction={(kind, overtimeEnd) => dayException.mutate({ kind, overtimeEnd })} />
      <ConfirmDialog open={dialog === 'resolveConflicts'} title={t('conflicts.resolveTitle')} description={t('conflicts.resolveAllBody', { count: conflicts.data?.count ?? 0 })} confirmLabel={t('conflicts.resolveConfirm')} cancelLabel={tCommon('cancel')} loading={resolveAllConflicts.isPending} onClose={() => setDialog(null)} onConfirm={() => resolveAllConflicts.mutate()} />
      <ConfirmDialog open={dialog === 'resolveAtRisk'} title={t('atRisk.resolveAll')} description={t('atRisk.resolveAllBody')} confirmLabel={t('atRisk.resolveAll')} cancelLabel={tCommon('cancel')} loading={resolveAllAtRisk.isPending} onClose={() => setDialog(null)} onConfirm={() => resolveAllAtRisk.mutate()} />
    </div>
  );
}

function UnscheduledBoard({ rows, total, loading, locale, className, onViewAll }: { rows: UnscheduledOrder[]; total?: number; loading: boolean; locale: string; className?: string; onViewAll?: () => void }) {
  const t = useTranslations('mobile.adminScheduling');
  const tm = useTranslations('mobile.production');
  const fmt = (v?: string | null) => (v ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(v)) : '—');
  return (
    <Board tone={rows.length ? 'warning' : 'success'} className={className}>
      <Board.Header title={t('unscheduledTitle')} description={t('unscheduledHint')} meta={total || rows.length ? <Stamp tone="warning" size="sm">{total ?? rows.length}</Stamp> : null} actions={onViewAll && (total ?? 0) > rows.length ? <Button size="sm" variant="ghost" onClick={onViewAll}>{t('viewAllOrders', { count: total ?? rows.length })}</Button> : null} />
      {loading ? (
        <BoardSkeleton header={false} rows={3} />
      ) : rows.length === 0 ? (
        <Board.Empty title={t('unscheduledTitle')} description={t('unscheduledHint')} />
      ) : (
        <ul className="divide-y divide-[var(--maher-border)]">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0">
                <Link href={`/admin/production/${o.id}?tab=schedule`} className="block truncate text-[14px] font-semibold text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)]">
                  {o.product ? localizedName(locale, { nameEn: o.product.nameEn ?? '', nameAr: o.product.nameAr, nameHe: o.product.nameHe }, o.productDescription) : o.productDescription}
                </Link>
                <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
                  <Ltr>{o.number}</Ltr>
                  {o.dealerName ? ` · ${o.dealerName}` : ''}
                  {o.requiredDeliveryDate ? ` · ${t('requiredBy', { date: fmt(o.requiredDeliveryDate) })}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {o.priority && (o.priority === 'HIGH' || o.priority === 'URGENT') ? <Stamp tone={o.priority === 'URGENT' ? 'error' : 'warning'} size="sm">{tm(`priority.${o.priority}` as never)}</Stamp> : null}
                <Stamp tone="warning" size="sm">
                  {t('unscheduledStatus')}
                </Stamp>
                <Link href={`/admin/production/${o.id}?tab=schedule`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)]" aria-label={t('scheduleOrder.action')}>
                  <CalendarClock className="h-4 w-4" />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Board>
  );
}
