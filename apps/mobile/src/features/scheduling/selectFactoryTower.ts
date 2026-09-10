import type {
  FactoryDayResponse,
  FactoryDayWorker,
  SchedulingSummary,
  UnscheduledOrderCard,
} from '@/api/modules/scheduling';
import type { ProductionTaskRow } from '@/features/production/selectProduction';
import { buildWorkerDayPlan, type WorkerDayBusyBlock } from '@/features/production/workerDayPlan';
import type { AdminScheduleStat } from './selectAdminScheduling';

export type TowerFocus =
  | 'today'
  | 'week'
  | 'unscheduled'
  | 'atRisk'
  | 'conflicts'
  | 'overtime'
  | null;

export function selectTowerStats(summary: SchedulingSummary | undefined): AdminScheduleStat[] {
  if (!summary) return [];
  return [
    { key: 'today', value: summary.today, tone: 'neutral' },
    { key: 'week', value: summary.thisWeek, tone: 'neutral' },
    {
      key: 'unscheduled',
      value: summary.unscheduled,
      tone: summary.unscheduled > 0 ? 'warning' : 'neutral',
    },
    { key: 'atRisk', value: summary.atRisk, tone: summary.atRisk > 0 ? 'danger' : 'neutral' },
    {
      key: 'conflicts',
      value: summary.conflicts,
      tone: summary.conflicts > 0 ? 'danger' : 'neutral',
    },
    {
      key: 'overtime',
      value: summary.overtime,
      tone: summary.overtime > 0 ? 'warning' : 'neutral',
    },
  ];
}

export function matchesDealerNames(
  value: string | null | undefined,
  names: string[] | undefined,
): boolean {
  if (!names?.length) return true;
  const needle = (value ?? '').trim().toLowerCase();
  if (!needle) return false;
  return names.some((name) => name.trim().toLowerCase() === needle);
}

export function filterUnscheduledCards(
  rows: UnscheduledOrderCard[] | undefined,
  opts: {
    q?: string;
    dealer?: string;
    dealerNames?: string[];
    readiness?: 'all' | 'ready' | 'needsPlanning';
  } = {},
): UnscheduledOrderCard[] {
  const q = (opts.q ?? '').trim().toLowerCase();
  const dealerNames = opts.dealerNames ?? (opts.dealer ? [opts.dealer] : undefined);
  return (rows ?? []).filter((row) => {
    if (opts.readiness === 'ready' && row.planningState === 'NEEDS_PLANNING') return false;
    if (opts.readiness === 'needsPlanning' && row.planningState !== 'NEEDS_PLANNING') return false;
    if (!matchesDealerNames(row.dealerName, dealerNames)) return false;
    if (!q) return true;
    const hay = [
      row.number,
      row.salesOrderNumber,
      row.productDescription,
      row.product?.nameEn,
      row.product?.nameAr,
      row.product?.sku,
      row.dealerName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function uniqueDealers(rows: UnscheduledOrderCard[] | undefined): string[] {
  const set = new Set<string>();
  for (const row of rows ?? []) {
    if (row.dealerName) set.add(row.dealerName);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function workerBusyToPlanBlocks(worker: FactoryDayWorker): WorkerDayBusyBlock[] {
  return worker.busy.map((b) => ({
    startMs: new Date(b.start).getTime(),
    endMs: new Date(b.end).getTime(),
    label: b.salesOrderNumber ?? b.orderNumber ?? b.stageName ?? '',
    salesOrderNumber: b.salesOrderNumber,
    stage: b.stageName,
    kind: b.kind === 'stopped' ? 'stopped' : 'work',
  }));
}

export function selectWorkerTimelineRow(worker: FactoryDayWorker) {
  const intervals = worker.intervals;
  const dayStartMs = intervals[0] ? new Date(intervals[0].start).getTime() : 0;
  const dayEndMs = intervals.length
    ? new Date(intervals[intervals.length - 1]!.end).getTime()
    : dayStartMs;
  return {
    worker,
    plan: buildWorkerDayPlan({
      dayStartMs,
      dayEndMs,
      busy: workerBusyToPlanBlocks(worker),
      capacityMinutes: worker.availableMinutes,
    }),
    overtimeAfterMs: worker.overtimeAfter ? new Date(worker.overtimeAfter).getTime() : null,
  };
}

const WEEKDAY_KEYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const;

export function weekdayKeyFromYmd(ymd: string): (typeof WEEKDAY_KEYS)[number] {
  const [ys, ms, ds] = ymd.split('-').map(Number);
  const dt = new Date(ys!, (ms ?? 1) - 1, ds ?? 1);
  return WEEKDAY_KEYS[dt.getDay()] ?? 'su';
}

export type WorkerWeekDayStatus = 'loading' | 'ready';

export type WorkerWeekDayRow = {
  date: string;
  weekdayKey: (typeof WEEKDAY_KEYS)[number];
  isSelected: boolean;
  status: WorkerWeekDayStatus;
  factoryClosed: boolean;
  worker: FactoryDayWorker | null;
  plannedMinutes: number;
  capacityMinutes: number;
  overtime: boolean;
};

export type WorkerWeekModel = {
  rows: WorkerWeekDayRow[];
  plannedMinutes: number;
  capacityMinutes: number;
  overtime: boolean;
};

export function selectWorkerWeek(
  days: Array<{
    date: string;
    day?: { closed: boolean; workers: FactoryDayWorker[] } | null;
  }>,
  employeeId: string,
  selectedDate: string,
): WorkerWeekModel {
  const rows: WorkerWeekDayRow[] = days.map(({ date, day }) => {
    const worker = day?.workers.find((row) => row.employeeId === employeeId) ?? null;
    const ready = Boolean(day);
    return {
      date,
      weekdayKey: weekdayKeyFromYmd(date),
      isSelected: date === selectedDate,
      status: ready ? 'ready' : 'loading',
      factoryClosed: Boolean(day?.closed),
      worker,
      plannedMinutes: worker?.scheduledMinutes ?? 0,
      capacityMinutes: worker?.availableMinutes ?? 0,
      overtime: Boolean(worker?.overtime),
    };
  });
  const ready = rows.filter((row) => row.status === 'ready');
  return {
    rows,
    plannedMinutes: ready.reduce((sum, row) => sum + row.plannedMinutes, 0),
    capacityMinutes: ready.reduce((sum, row) => sum + row.capacityMinutes, 0),
    overtime: ready.some((row) => row.overtime),
  };
}

export function minutesLabel(minutes: number): string {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${Math.round(hours * 10) / 10}h`;
}

export function workersForStage(
  day: FactoryDayResponse | undefined,
  stageId: string,
): FactoryDayWorker[] {
  if (!day) return [];
  const stage = day.stages.find(
    (row) => (row.stageDefinitionId ?? row.departmentId ?? row.code) === stageId,
  );
  const ids = new Set((stage?.workers ?? []).map((w) => w.employeeId));
  if (ids.size === 0) return day.workers;
  return day.workers.filter((w) => ids.has(w.employeeId));
}

export function unscheduledStageToTaskRow(
  order: UnscheduledOrderCard,
  stage: UnscheduledOrderCard['stages'][number],
  locale = 'en',
): ProductionTaskRow {
  const name =
    locale === 'ar'
      ? stage.nameAr ?? stage.nameEn ?? stage.code ?? order.number
      : locale === 'he'
        ? stage.nameHe ?? stage.nameEn ?? stage.code ?? order.number
        : stage.nameEn ?? stage.code ?? order.number;
  return {
    id: stage.taskId,
    name,
    number: order.number,
    status: stage.placed ? 'IN_PROGRESS' : 'PENDING',
    priority: order.priority ?? 'NORMAL',
    progressPercent: 0,
    notes: '',
    assigneeId: stage.assignedEmployeeId,
    assigneeName: stage.assignedName,
    departmentLabel: null,
    responsibleDepartment: null,
    canAssign: order.planningState !== 'NEEDS_PLANNING',
    canHold: false,
    canBlock: false,
    canEditNotes: false,
    isCompleted: false,
    openBlockerCount: 0,
    elapsedMinutes: 0,
    estimatedMinutes: stage.estimatedMinutes,
    timingStatus: null,
    plannedStart: stage.plannedStart,
    plannedCompletion: stage.plannedCompletion,
    actualStart: null,
    actualEnd: null,
    stageCode: stage.code,
    stageDefinitionId: stage.stageDefinitionId,
    dependsOnCodes: [],
  };
}

export function canScheduleOrder(state: UnscheduledOrderCard['planningState']): boolean {
  return state === 'READY_TO_SCHEDULE' || state === 'PARTIALLY_SCHEDULED';
}
