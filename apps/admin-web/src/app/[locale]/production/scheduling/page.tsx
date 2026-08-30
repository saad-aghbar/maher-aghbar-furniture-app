'use client';

import { DayExceptionDialog, type DayExceptionKind } from '@/components/scheduling/day-exception-dialog';
import { MonthBoard } from '@/components/scheduling/month-board';
import {
  ApproveScheduleDialog,
  ChangeDateDialog,
  RecalculateScheduleDialog,
  SyncScheduleDialog,
  OptimizeScheduleDialog,
  type SyncDialogPhase,
  type SyncDialogStats,
  type OptimizeDialogPhase,
  type OptimizeDialogStats,
} from '@/components/scheduling/schedule-action-dialogs';
import { ScheduleOrderRow } from '@/components/scheduling/schedule-order-row';
import { StatChips } from '@/components/scheduling/stat-chips';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useAuthMe } from '@/hooks/use-auth-me';
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
import type {
  AtRiskOrder,
  CalendarResponse,
  CapacityRow,
  ProductionScheduleDetail,
  SchedulingDashboard,
} from '@/lib/scheduling';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHero,
  Skeleton,
  SurfaceCard,
} from '@maher/ui';
import { can } from '@maher/permissions';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, RefreshCcw, RefreshCw, Settings2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

interface CapacityApiShape {
  departments?: CapacityRow[];
  data?: CapacityRow[];
}

interface AtRiskApiShape {
  data?: AtRiskOrder[];
}

function normalizeCalendar(raw: unknown): CalendarResponse {
  if (!raw || typeof raw !== 'object') return { calendar: null, days: [], orders: [] };
  const shaped = raw as CalendarResponse & { data?: CalendarResponse['orders'] };
  return {
    calendar: shaped.calendar ?? null,
    days: Array.isArray(shaped.days) ? shaped.days : [],
    orders: Array.isArray(shaped.orders)
      ? shaped.orders
      : Array.isArray(shaped.data)
        ? shaped.data
        : [],
  };
}

function normalizeDepartments(raw: unknown): CapacityRow[] {
  if (Array.isArray(raw)) return raw as CapacityRow[];
  const shaped = raw as CapacityApiShape | null | undefined;
  return shaped?.departments ?? shaped?.data ?? [];
}

function normalizeAtRisk(raw: unknown): AtRiskOrder[] {
  if (Array.isArray(raw)) return raw as AtRiskOrder[];
  return (raw as AtRiskApiShape | null | undefined)?.data ?? [];
}

function departmentLabel(locale: string, row: CapacityRow) {
  if (locale === 'ar') return row.nameAr || row.nameEn || row.code || '—';
  if (locale === 'he') return row.nameHe || row.nameEn || row.code || '—';
  return row.nameEn || row.nameAr || row.code || '—';
}

function focusEmptyKey(focus: ScheduleFocusKey): string {
  if (focus === 'today') return 'dayEmpty';
  if (focus === 'week') return 'weekOrdersEmpty';
  if (focus === 'awaitingApproval') return 'approvalsEmpty';
  if (focus === 'atRisk') return 'atRiskEmpty';
  return 'conflictsEmpty';
}

function focusTitleKey(focus: ScheduleFocusKey): string {
  if (focus === 'today') return 'stats.today';
  if (focus === 'week') return 'weekOrdersTitle';
  if (focus === 'awaitingApproval') return 'approvalsTitle';
  if (focus === 'atRisk') return 'atRiskTitle';
  return 'conflictsTitle';
}

type ReplanRunPayload = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  changeType?: string;
  result?: {
    outcome?: 'UP_TO_DATE' | 'CHANGED' | 'PARTIAL' | 'FAILED';
    mode?: 'preview' | 'apply';
    scannedOrders?: number;
    alreadyValid?: number;
    generated?: number;
    replanned?: number;
    replannedOrders?: number;
    pastDueRescheduled?: number;
    moved?: number;
    wouldMove?: number;
    candidateOrders?: number;
    atRiskRecovered?: number;
    recoveredAtRisk?: number;
    stillNeedsAttention?: number;
    blocked?: number;
    manualAttention?: number;
    conflictsResolved?: number;
    emptyDays?: Array<{ ymd: string; causeKey?: string | null }>;
    failures?: unknown[];
    alreadyValid?: number;
    generated?: number;
    replanned?: number;
    replannedOrders?: number;
    atRiskRecovered?: number;
    recoveredAtRisk?: number;
    stillNeedsAttention?: number;
    blocked?: number;
    manualAttention?: number;
    conflictsResolved?: number;
    failures?: unknown[];
  } | null;
};

type SyncEnqueuePayload = {
  replanQueued?: boolean;
  replanJobId?: string;
  alreadyInProgress?: boolean;
  status?: string;
};

function syncStatsFromRun(run?: ReplanRunPayload | null): SyncDialogStats {
  const result = run?.result;
  return {
    scanned: result?.scannedOrders ?? 0,
    alreadyValid: result?.alreadyValid ?? 0,
    generated: result?.generated ?? 0,
    replanned: result?.replanned ?? result?.replannedOrders ?? 0,
    pastDueRescheduled: result?.pastDueRescheduled ?? 0,
    atRiskRecovered: result?.atRiskRecovered ?? result?.recoveredAtRisk ?? 0,
    stillAttention: result?.stillNeedsAttention ?? (result?.blocked ?? 0) + (result?.manualAttention ?? 0),
    conflictsResolved: result?.conflictsResolved ?? 0,
  };
}

function syncPhaseFromRun(run?: ReplanRunPayload | null): SyncDialogPhase {
  if (!run) return 'confirm';
  if (run.status === 'QUEUED' || run.status === 'RUNNING') return 'syncing';
  if (run.status === 'FAILED') return 'failed';
  const outcome = run.result?.outcome;
  if (outcome === 'UP_TO_DATE') return 'upToDate';
  if (outcome === 'PARTIAL') return 'partial';
  if (outcome === 'FAILED') return 'failed';
  if (outcome === 'CHANGED') return 'changed';
  const stats = syncStatsFromRun(run);
  if (stats.generated + stats.replanned === 0 && stats.stillAttention === 0) return 'upToDate';
  if (stats.stillAttention > 0) return 'partial';
  return 'changed';
}

function optimizeStatsFromRun(run?: ReplanRunPayload | null): OptimizeDialogStats {
  const result = run?.result;
  return {
    scanned: result?.scannedOrders ?? 0,
    wouldMove: result?.wouldMove ?? result?.candidateOrders ?? 0,
    moved: result?.moved ?? result?.replanned ?? 0,
    stillAttention: result?.stillNeedsAttention ?? (result?.blocked ?? 0),
    emptyDays: (result?.emptyDays ?? [])
      .filter((d) => d.causeKey)
      .slice(0, 8)
      .map((d) => ({ ymd: d.ymd, causeKey: d.causeKey as string })),
  };
}

function optimizePhaseFromRun(run?: ReplanRunPayload | null): OptimizeDialogPhase {
  if (!run) return 'confirm';
  if (run.status === 'QUEUED' || run.status === 'RUNNING') {
    return run.result?.mode === 'apply' ? 'applying' : 'previewing';
  }
  if (run.status === 'FAILED') return 'failed';
  const outcome = run.result?.outcome;
  const mode = run.result?.mode;
  if (mode !== 'apply') {
    if (outcome === 'UP_TO_DATE') return 'upToDate';
    if (outcome === 'FAILED') return 'failed';
    if (outcome === 'CHANGED' || outcome === 'PARTIAL') return 'preview';
  }
  if (outcome === 'UP_TO_DATE') return 'upToDate';
  if (outcome === 'PARTIAL') return 'partial';
  if (outcome === 'FAILED') return 'failed';
  if (outcome === 'CHANGED') return 'changed';
  const stats = optimizeStatsFromRun(run);
  if (mode !== 'apply') {
    if (stats.wouldMove === 0) return 'upToDate';
    return 'preview';
  }
  if (stats.moved === 0 && stats.stillAttention === 0) return 'upToDate';
  if (stats.stillAttention > 0) return 'partial';
  return 'changed';
}

async function pollReplanRun(runId: string, timeoutMs = 5 * 60_000): Promise<ReplanRunPayload> {
  const started = Date.now();
  let last: ReplanRunPayload | null = null;
  while (Date.now() - started < timeoutMs) {
    last = await apiFetch<ReplanRunPayload>(`/api/v1/scheduling/replan-runs/${encodeURIComponent(runId)}`);
    if (last.status === 'COMPLETED' || last.status === 'FAILED') return last;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return last ?? { id: runId, status: 'RUNNING' };
}

export default function SchedulingPage() {
  const t = useTranslations('mobile.adminScheduling');
  const tp = useTranslations('production');
  const locale = useLocale();
  const qc = useQueryClient();
  const me = useAuthMe();
  const canManage = can(me.data, 'schedule.manage');

  const today = todayYmd();
  const weekRange = useMemo(() => weekRangeFromYmd(today), [today]);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(today);
  const [focus, setFocus] = useState<ScheduleFocusKey | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState<AdminScheduleCardModel | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [changeDateOpen, setChangeDateOpen] = useState(false);
  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [dayExceptionOpen, setDayExceptionOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncPhase, setSyncPhase] = useState<SyncDialogPhase>('confirm');
  const [syncStats, setSyncStats] = useState<SyncDialogStats | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncPollRef = useRef<string | null>(null);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizePhase, setOptimizePhase] = useState<OptimizeDialogPhase>('confirm');
  const [optimizeStats, setOptimizeStats] = useState<OptimizeDialogStats | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const optimizePollRef = useRef<string | null>(null);

  const monthRange = useMemo(() => monthRangeYmd(year, monthIndex), [year, monthIndex]);
  const needsWeekWindow = focus === 'today' || focus === 'week';

  const dashboardQuery = useQuery({
    queryKey: ['scheduling-dashboard'],
    queryFn: () => apiFetch<SchedulingDashboard>('/api/v1/scheduling/dashboard'),
    retry: false,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const calendarQuery = useQuery({
    queryKey: ['scheduling-calendar', monthRange.from, monthRange.to],
    queryFn: () =>
      apiFetch<unknown>(
        `/api/v1/scheduling/calendar?from=${monthRange.from}&to=${monthRange.to}&view=month`,
      ).then(normalizeCalendar),
    retry: false,
    placeholderData: keepPreviousData,
  });

  const weekCalendarQuery = useQuery({
    queryKey: ['scheduling-calendar', weekRange.from, weekRange.to, 'week'],
    queryFn: () =>
      apiFetch<unknown>(
        `/api/v1/scheduling/calendar?from=${weekRange.from}&to=${weekRange.to}&view=week`,
      ).then(normalizeCalendar),
    enabled: needsWeekWindow,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const atRiskQuery = useQuery({
    queryKey: ['scheduling-at-risk'],
    queryFn: () => apiFetch<unknown>('/api/v1/scheduling/at-risk').then(normalizeAtRisk),
    retry: false,
    placeholderData: keepPreviousData,
  });

  const capacityQuery = useQuery({
    queryKey: ['scheduling-capacity', monthRange.from, monthRange.to],
    queryFn: () =>
      apiFetch<unknown>(
        `/api/v1/scheduling/capacity?from=${monthRange.from}&to=${monthRange.to}`,
      ).then(normalizeDepartments),
    retry: false,
    placeholderData: keepPreviousData,
  });

  const stats = useMemo(() => selectDashboardStats(dashboardQuery.data), [dashboardQuery.data]);
  const monthMeta = useMemo(
    () => selectMonthDayMeta(calendarQuery.data?.days, calendarQuery.data?.orders),
    [calendarQuery.data],
  );
  const dayOrders = useMemo(
    () => selectOrdersForDay(calendarQuery.data?.orders, selectedDay, locale),
    [calendarQuery.data?.orders, locale, selectedDay],
  );
  const selectedDayInfo = monthMeta[selectedDay];
  const calendarMeta = calendarQuery.data?.calendar;
  const selectedDayException = (calendarMeta?.exceptions ?? []).find(
    (ex) => String(ex.date).slice(0, 10) === selectedDay,
  );

  const atRisk = useMemo(() => selectAtRiskCards(atRiskQuery.data, locale), [atRiskQuery.data, locale]);

  const focusSourceOrders = useMemo(() => {
    const monthOrders = calendarQuery.data?.orders ?? [];
    const weekOrders = weekCalendarQuery.data?.orders ?? [];
    if (!weekOrders.length) return monthOrders;
    if (!monthOrders.length) return weekOrders;
    const byId = new Map<string, (typeof monthOrders)[number]>();
    for (const order of [...monthOrders, ...weekOrders]) {
      byId.set(order.productionOrderId, order);
    }
    return [...byId.values()];
  }, [calendarQuery.data?.orders, weekCalendarQuery.data?.orders]);

  const focusCards = useMemo(() => {
    if (!focus) return [];
    if (focus === 'today') return selectOrdersForDay(focusSourceOrders, today, locale);
    if (focus === 'week') {
      return selectOrdersInRange(focusSourceOrders, weekRange.from, weekRange.to, locale);
    }
    if (focus === 'awaitingApproval') return selectApprovalsWaiting(focusSourceOrders, locale);
    if (focus === 'atRisk') return atRisk;
    return selectConflictCards(focusSourceOrders, locale);
  }, [atRisk, focus, focusSourceOrders, locale, today, weekRange.from, weekRange.to]);

  const visibleFocusCards = useMemo(
    () => filterScheduleCards(focusCards, orderSearch),
    [focusCards, orderSearch],
  );
  const visibleDayOrders = useMemo(
    () => filterScheduleCards(dayOrders, orderSearch),
    [dayOrders, orderSearch],
  );
  const visibleCards = focus ? visibleFocusCards : visibleDayOrders;

  async function invalidateBoard() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['scheduling-calendar'] }),
      qc.invalidateQueries({ queryKey: ['scheduling-dashboard'] }),
      qc.invalidateQueries({ queryKey: ['scheduling-at-risk'] }),
      qc.invalidateQueries({ queryKey: ['scheduling-capacity'] }),
    ]);
  }

  async function pollFactorySync(runId: string, conflictInProgress = false) {
    if (syncPollRef.current === runId) return;
    syncPollRef.current = runId;
    setSyncOpen(true);
    setSyncPhase(conflictInProgress ? 'inProgress' : 'syncing');
    try {
      const run = await pollReplanRun(runId);
      const phase = syncPhaseFromRun(run);
      setSyncPhase(phase);
      setSyncStats(syncStatsFromRun(run));
      if (phase === 'upToDate') {
        setBanner(t('sync.upToDate'));
      } else if (phase === 'changed') {
        setBanner(t('sync.complete'));
      } else if (phase === 'partial') {
        setBanner(t('sync.partial'));
      } else if (phase === 'failed') {
        setError(t('sync.failed'));
      }
      await invalidateBoard();
    } catch (err) {
      setSyncPhase('failed');
      setSyncError(mutationErrorMessage(err, t('sheets.genericError')));
    } finally {
      if (syncPollRef.current === runId) syncPollRef.current = null;
    }
  }

  async function startFactorySync() {
    setSyncError(null);
    setSyncPhase('syncing');
    try {
      const queued = await apiFetch<SyncEnqueuePayload>('/api/v1/scheduling/sync', { method: 'POST' });
      if (!queued.replanJobId) {
        setSyncPhase('failed');
        return;
      }
      await pollFactorySync(queued.replanJobId);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const runId = (err.body as { runId?: string } | undefined)?.runId;
        setSyncPhase('inProgress');
        setSyncOpen(true);
        if (runId) await pollFactorySync(runId, true);
        return;
      }
      setSyncPhase('failed');
      setSyncError(mutationErrorMessage(err, t('sheets.genericError')));
      setSyncOpen(true);
    }
  }

  const latestSyncQuery = useQuery({
    queryKey: ['scheduling-replan-latest'],
    queryFn: async () =>
      (await apiFetch<ReplanRunPayload | null>('/api/v1/scheduling/replan-runs/latest')) ?? null,
    enabled: canManage,
    staleTime: 8_000,
    refetchInterval: syncPhase === 'syncing' || syncPhase === 'inProgress' ? 4_000 : false,
  });

  useEffect(() => {
    const run = latestSyncQuery.data;
    if (!canManage || !run) return;
    if (run.status !== 'QUEUED' && run.status !== 'RUNNING') return;
    void pollFactorySync(run.id);
    // Join an in-flight manual sync when returning to the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, latestSyncQuery.data?.id, latestSyncQuery.data?.status]);

  async function pollCapacityOptimize(runId: string, conflictInProgress = false) {
    if (optimizePollRef.current === runId) return;
    optimizePollRef.current = runId;
    setOptimizeOpen(true);
    setOptimizePhase(conflictInProgress ? 'inProgress' : 'previewing');
    try {
      const run = await pollReplanRun(runId);
      const phase = optimizePhaseFromRun(run);
      setOptimizePhase(phase);
      setOptimizeStats(optimizeStatsFromRun(run));
      if (phase === 'upToDate') {
        setBanner(t('optimize.upToDate'));
      } else if (phase === 'changed') {
        setBanner(t('optimize.complete'));
      } else if (phase === 'partial') {
        setBanner(t('optimize.partial'));
      } else if (phase === 'failed') {
        setError(t('optimize.failed'));
      }
      if (phase === 'changed' || phase === 'partial') await invalidateBoard();
    } catch (err) {
      setOptimizePhase('failed');
      setOptimizeError(mutationErrorMessage(err, t('sheets.genericError')));
    } finally {
      if (optimizePollRef.current === runId) optimizePollRef.current = null;
    }
  }

  async function startCapacityOptimize(path: '/api/v1/scheduling/optimize/preview' | '/api/v1/scheduling/optimize/apply') {
    setOptimizeError(null);
    setOptimizePhase(path.endsWith('apply') ? 'applying' : 'previewing');
    try {
      const queued = await apiFetch<SyncEnqueuePayload>(path, { method: 'POST' });
      if (!queued.replanJobId) {
        setOptimizePhase('failed');
        return;
      }
      await pollCapacityOptimize(queued.replanJobId);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const runId = (err.body as { runId?: string } | undefined)?.runId;
        setOptimizePhase('inProgress');
        setOptimizeOpen(true);
        if (runId) await pollCapacityOptimize(runId, true);
        return;
      }
      setOptimizePhase('failed');
      setOptimizeError(mutationErrorMessage(err, t('sheets.genericError')));
      setOptimizeOpen(true);
    }
  }

  const latestOptimizeQuery = useQuery({
    queryKey: ['scheduling-replan-latest-optimize'],
    queryFn: async () =>
      (await apiFetch<ReplanRunPayload | null>('/api/v1/scheduling/replan-runs/latest-optimize')) ??
      null,
    enabled: canManage,
    staleTime: 8_000,
    refetchInterval:
      optimizePhase === 'previewing' || optimizePhase === 'applying' || optimizePhase === 'inProgress'
        ? 4_000
        : false,
  });

  useEffect(() => {
    const run = latestOptimizeQuery.data;
    if (!canManage || !run) return;
    if (run.status !== 'QUEUED' && run.status !== 'RUNNING') return;
    void pollCapacityOptimize(run.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, latestOptimizeQuery.data?.id, latestOptimizeQuery.data?.status]);

  function jumpToScheduleStart(detail: ProductionScheduleDetail) {
    const allocations = detail.schedule?.allocations ?? [];
    if (allocations.length === 0) return;
    let minStart = allocations[0]!.plannedStart;
    for (const a of allocations) {
      if (a.plannedStart < minStart) minStart = a.plannedStart;
    }
    const ymd = minStart.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    setFocus(null);
    setSelectedDay(ymd);
    const [ys, ms] = ymd.split('-').map(Number);
    if (ys && ms) {
      setYear(ys);
      setMonthIndex(ms - 1);
    }
  }

  const approveMutation = useMutation({
    mutationFn: async (vars: { id: string; version: number }) => {
      let version = vars.version;
      try {
        const latest = await apiFetch<ProductionScheduleDetail>(`/api/v1/scheduling/orders/${vars.id}`);
        if (latest.schedule?.version != null) version = latest.schedule.version;
      } catch {
        /* fall back to card version */
      }
      return apiFetch(`/api/v1/scheduling/orders/${vars.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ version, idempotencyKey: `approve-${vars.id}-${Date.now()}` }),
      });
    },
    onSuccess: async () => {
      setError(null);
      setBanner(t('sheets.approveSuccess'));
      setApproveOpen(false);
      await invalidateBoard();
    },
    onError: (err) => setError(mutationErrorMessage(err, t('sheets.genericError'))),
  });

  const changeDateMutation = useMutation({
    mutationFn: async (vars: { id: string; isoDate: string; reason?: string }) => {
      await apiFetch(`/api/v1/scheduling/orders/${vars.id}/dealer-date`, {
        method: 'POST',
        body: JSON.stringify({
          requestedDeliveryDate: vars.isoDate,
          reason: vars.reason,
          idempotencyKey: `admin-date-${vars.id}-${Date.now()}`,
        }),
      });
      return apiFetch<ProductionScheduleDetail>(`/api/v1/scheduling/orders/${vars.id}`);
    },
    onSuccess: async (detail) => {
      setError(null);
      setBanner(t('sheets.changeDateSuccess'));
      setChangeDateOpen(false);
      jumpToScheduleStart(detail);
      await invalidateBoard();
    },
    onError: (err) => setError(mutationErrorMessage(err, t('sheets.genericError'))),
  });

  const recalculateMutation = useMutation({
    mutationFn: async (vars: { id: string; reason?: string }) => {
      await apiFetch(`/api/v1/scheduling/orders/${vars.id}/recalculate`, {
        method: 'POST',
        body: JSON.stringify({ reason: vars.reason }),
      });
      return apiFetch<ProductionScheduleDetail>(`/api/v1/scheduling/orders/${vars.id}`);
    },
    onSuccess: async (detail) => {
      setError(null);
      setBanner(t('sheets.recalculateSuccess'));
      setRecalculateOpen(false);
      jumpToScheduleStart(detail);
      await invalidateBoard();
    },
    onError: (err) => setError(mutationErrorMessage(err, t('sheets.genericError'))),
  });

  const recalculateAllMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiFetch(`/api/v1/scheduling/orders/${id}/recalculate`, {
            method: 'POST',
            body: '{}',
          }),
        ),
      );
      return {
        ok: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
      };
    },
    onSuccess: async ({ ok, failed }) => {
      setError(null);
      setBanner(tp('recalculateAllResult', { ok, failed }));
      await invalidateBoard();
    },
    onError: (err) => setError(mutationErrorMessage(err, t('sheets.genericError'))),
  });

  const dayExceptionMutation = useMutation({
    mutationFn: async (action: { kind: DayExceptionKind; overtimeEnd?: string }) => {
      if (action.kind === 'clear') {
        return apiFetch(`/api/v1/scheduling/calendar-settings/exceptions/${encodeURIComponent(selectedDay)}`, {
          method: 'DELETE',
        });
      }
      if (action.kind === 'close') {
        return apiFetch('/api/v1/scheduling/calendar-settings/exceptions', {
          method: 'POST',
          body: JSON.stringify({ date: selectedDay, type: 'SHUTDOWN', note: 'Closed by admin' }),
        });
      }
      if (action.kind === 'overtime') {
        return apiFetch('/api/v1/scheduling/calendar-settings/exceptions', {
          method: 'POST',
          body: JSON.stringify({
            date: selectedDay,
            type: 'EXTRA_SHIFT',
            shiftStart: calendarMeta?.shiftStart ?? '08:00',
            shiftEnd: action.overtimeEnd ?? '20:00',
            note: 'Overtime',
          }),
        });
      }
      return apiFetch('/api/v1/scheduling/calendar-settings/exceptions', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDay,
          type: 'EXTRA_SHIFT',
          shiftStart: calendarMeta?.shiftStart ?? '08:00',
          shiftEnd: calendarMeta?.shiftEnd ?? '16:00',
          note: 'Opened by admin',
        }),
      });
    },
    onSuccess: async () => {
      setError(null);
      setBanner(tp('scheduleUpdated'));
      setDayExceptionOpen(false);
      await invalidateBoard();
    },
    onError: (err) => setError(mutationErrorMessage(err, t('sheets.genericError'))),
  });

  function onStatSelect(key: ScheduleFocusKey) {
    if (focus === key) {
      setFocus(null);
      setOrderSearch('');
      return;
    }
    setFocus(key);
    setOrderSearch('');
    if (key === 'today' || key === 'week') {
      const d = new Date();
      setYear(d.getFullYear());
      setMonthIndex(d.getMonth());
      setSelectedDay(today);
    }
  }

  function onMonthChange(nextYear: number, nextMonth: number) {
    setYear(nextYear);
    setMonthIndex(nextMonth);
    const range = monthRangeYmd(nextYear, nextMonth);
    if (selectedDay < range.from || selectedDay > range.to) {
      setSelectedDay(today >= range.from && today <= range.to ? today : range.from);
    }
  }

  function onRowAction(mode: AdminScheduleActionMode, card: AdminScheduleCardModel) {
    setSelectedCard(card);
    setError(null);
    if (mode === 'approve') setApproveOpen(true);
    else if (mode === 'changeDate') setChangeDateOpen(true);
    else setRecalculateOpen(true);
  }

  const boardLoading = calendarQuery.isLoading && !calendarQuery.data;
  const chipsLoading = dashboardQuery.isLoading && !dashboardQuery.data;
  const listEmpty = visibleCards.length === 0;
  const listSearching = orderSearch.trim().length > 0;
  const dayClosed = Boolean(selectedDayInfo && !selectedDayInfo.isWorking);

  const listTitle = focus
    ? t(focusTitleKey(focus))
    : t('dayOrdersTitle', { date: formatYmdLabel(selectedDay, locale) });

  const emptyTitle = listSearching
    ? t('searchEmpty')
    : focus
      ? t(focusEmptyKey(focus))
      : dayClosed
        ? t('dayClosed')
        : t('dayEmpty');

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('subtitle')}
        tone="soft"
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<RefreshCcw className="h-3.5 w-3.5" />}
              loading={syncPhase === 'syncing'}
              onClick={() => {
                if (syncPollRef.current || syncPhase === 'syncing') {
                  setSyncOpen(true);
                  return;
                }
                setSyncError(null);
                setSyncPhase('confirm');
                setSyncStats(null);
                setSyncOpen(true);
              }}
            >
              {t('sync.action')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Gauge className="h-3.5 w-3.5" />}
              loading={optimizePhase === 'previewing' || optimizePhase === 'applying'}
              onClick={() => {
                if (
                  optimizePollRef.current ||
                  optimizePhase === 'previewing' ||
                  optimizePhase === 'applying'
                ) {
                  setOptimizeOpen(true);
                  return;
                }
                setOptimizeError(null);
                setOptimizePhase('confirm');
                setOptimizeStats(null);
                setOptimizeOpen(true);
              }}
            >
              {t('optimize.action')}
            </Button>
            </div>
          ) : null
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error && !approveOpen && !changeDateOpen && !recalculateOpen && !dayExceptionOpen && !syncOpen && !optimizeOpen ? (
        <Alert variant="error">{error}</Alert>
      ) : null}

      <StatChips stats={stats} loading={chipsLoading} focus={focus} onSelect={onStatSelect} />

      {focus ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-[var(--maher-brand-soft)] px-3 py-1.5 text-sm text-brand">
          <span>{t(`focusFilter.${focus}`)}</span>
          <button
            type="button"
            onClick={() => {
              setFocus(null);
              setOrderSearch('');
            }}
            className="ms-1 text-xs font-semibold underline"
          >
            {t('clearFocus')}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
          loading={recalculateAllMutation.isPending}
          disabled={visibleCards.length === 0}
          onClick={() =>
            recalculateAllMutation.mutate([...new Set(visibleCards.map((c) => c.productionOrderId))])
          }
        >
          {tp('recalculateAll')}
        </Button>
      </div>

      {calendarQuery.isError && !calendarQuery.data ? (
        <ErrorState
          title={t('errorTitle')}
          description={t('errorBody')}
          onRetry={() => void calendarQuery.refetch()}
          retryLabel={t('retry')}
        />
      ) : (
        <div
          className={
            focus
              ? 'grid gap-4'
              : 'grid items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]'
          }
        >
          {!focus ? (
            <MonthBoard
              year={year}
              monthIndex={monthIndex}
              selectedDay={selectedDay}
              dayMeta={monthMeta}
              loading={boardLoading}
              onSelectDay={(ymd) => {
                setSelectedDay(ymd);
                setOrderSearch('');
              }}
              onMonthChange={onMonthChange}
            />
          ) : null}

          <SurfaceCard className="p-4" interactive={false} tilt={false}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{listTitle}</h2>
                {!focus && dayClosed ? (
                  <p className="text-xs text-text-tertiary">{t('dayClosed')}</p>
                ) : null}
              </div>
              {!focus ? (
                <Button
                  size="sm"
                  variant="ghost"
                  leadingIcon={<Settings2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setError(null);
                    setDayExceptionOpen(true);
                  }}
                >
                  {t('dayCapacity.edit')}
                </Button>
              ) : null}
            </div>
            <Input
              withSearchIcon
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
            />
            <div className="mt-3 space-y-2">
              {boardLoading && !focus ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))
              ) : listEmpty ? (
                <EmptyState title={emptyTitle} className="py-10" />
              ) : (
                visibleCards.map((card) => (
                  <ScheduleOrderRow key={card.id} card={card} onAction={onRowAction} />
                ))
              )}
            </div>
          </SurfaceCard>
        </div>
      )}

      <SurfaceCard className="p-4" interactive={false} tilt={false}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">{tp('capacityStrip')}</h2>
          <p className="text-xs text-text-tertiary" dir="ltr">
            {monthRange.from} – {monthRange.to}
          </p>
        </div>
        {capacityQuery.isLoading && !capacityQuery.data ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (capacityQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-text-tertiary">{tp('capacityHint')}</p>
        ) : (
          <div className="space-y-2">
            {(capacityQuery.data ?? []).map((row) => {
              const pct =
                row.capacityMinutes > 0
                  ? Math.min(100, Math.round((row.bookedMinutes / row.capacityMinutes) * 100))
                  : 0;
              const barColor =
                pct >= 100
                  ? 'bg-[var(--maher-error)]'
                  : pct >= 80
                    ? 'bg-[var(--maher-warning)]'
                    : 'bg-[var(--maher-success)]';
              return (
                <div key={row.departmentId}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-text-primary">{departmentLabel(locale, row)}</span>
                    <span className="tabular-nums text-text-secondary" dir="ltr">
                      {Math.round(row.bookedMinutes / 60)}h / {Math.round(row.capacityMinutes / 60)}h · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--maher-surface-muted)]">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      <ApproveScheduleDialog
        open={approveOpen}
        card={selectedCard}
        loading={approveMutation.isPending}
        error={approveOpen ? error : null}
        onClose={() => setApproveOpen(false)}
        onConfirm={() => {
          if (!selectedCard || selectedCard.scheduleVersion == null) return;
          approveMutation.mutate({
            id: selectedCard.productionOrderId,
            version: selectedCard.scheduleVersion,
          });
        }}
      />
      <ChangeDateDialog
        open={changeDateOpen}
        card={selectedCard}
        loading={changeDateMutation.isPending}
        error={changeDateOpen ? error : null}
        onClose={() => setChangeDateOpen(false)}
        onSubmit={(isoDate, reason) => {
          if (!selectedCard) return;
          changeDateMutation.mutate({
            id: selectedCard.productionOrderId,
            isoDate,
            reason,
          });
        }}
      />
      <RecalculateScheduleDialog
        open={recalculateOpen}
        card={selectedCard}
        loading={recalculateMutation.isPending}
        error={recalculateOpen ? error : null}
        onClose={() => setRecalculateOpen(false)}
        onConfirm={(reason) => {
          if (!selectedCard) return;
          recalculateMutation.mutate({ id: selectedCard.productionOrderId, reason });
        }}
      />
      <DayExceptionDialog
        open={dayExceptionOpen}
        onClose={() => setDayExceptionOpen(false)}
        dateYmd={selectedDay}
        isWorking={Boolean(selectedDayInfo?.isWorking)}
        hasException={Boolean(selectedDayException)}
        defaultShiftStart={calendarMeta?.shiftStart ?? '08:00'}
        defaultShiftEnd={calendarMeta?.shiftEnd ?? '16:00'}
        loading={dayExceptionMutation.isPending}
        errorMessage={dayExceptionOpen ? error : null}
        onAction={(kind, overtimeEnd) => dayExceptionMutation.mutate({ kind, overtimeEnd })}
      />
      <SyncScheduleDialog
        open={syncOpen}
        phase={syncPhase}
        stats={syncStats}
        error={syncError}
        onClose={() => {
          setSyncOpen(false);
          if (syncPhase !== 'syncing') {
            setSyncPhase('confirm');
            setSyncStats(null);
            setSyncError(null);
          }
        }}
        onConfirm={() => {
          void startFactorySync();
        }}
        onRetry={() => {
          void startFactorySync();
        }}
      />
      <OptimizeScheduleDialog
        open={optimizeOpen}
        phase={optimizePhase}
        stats={optimizeStats}
        error={optimizeError}
        onClose={() => {
          setOptimizeOpen(false);
          if (optimizePhase !== 'previewing' && optimizePhase !== 'applying') {
            setOptimizePhase('confirm');
            setOptimizeStats(null);
            setOptimizeError(null);
          }
        }}
        onConfirm={() => {
          void startCapacityOptimize('/api/v1/scheduling/optimize/preview');
        }}
        onApply={() => {
          void startCapacityOptimize('/api/v1/scheduling/optimize/apply');
        }}
        onRetry={() => {
          void startCapacityOptimize('/api/v1/scheduling/optimize/preview');
        }}
      />
    </div>
  );
}
