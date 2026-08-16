import { formatTime } from '@/i18n/format';
import type { Locale } from '@maher/types';

export type ScheduleDateSource = {
  requestedDeliveryDate?: string | null;
  suggestedDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  earliestAvailableDate?: string | null;
  requestedDateFeasible?: boolean | null;
  unschedulableReason?: string | null;
  materialRisk?: boolean | null;
  requiresAdminEstimateReview?: boolean | null;
  scheduleStatus?: string | null;
  promiseState?: string | null;
  planningMode?: string | null;
  riskStatus?: string | null;
  reasonCode?: string | null;
  materialReadyAt?: string | null;
  committedCompletionDate?: string | null;
  productionDeadline?: string | null;
  deliveryBufferWorkingDays?: number | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
};

export type ScheduleRowPlan = 'identical' | 'expanded' | 'earliest' | 'infeasible' | 'blocked';

export type BlockedScheduleCopy = {
  titleKey: string;
  bodyKey: string;
  reasonKey: string;
  name?: string;
};

export type ScheduleDatePresentation = {
  plan: ScheduleRowPlan;
  requestedIso: string | null;
  suggestedIso: string | null;
  committedIso: string | null;
  earliestIso: string | null;
  projectedIso: string | null;
  plannedStartIso: string | null;
  plannedEndIso: string | null;
  productionDeadlineIso: string | null;
  materialReadyAtIso: string | null;
  deliveryBufferWorkingDays: number | null;
  feasible: boolean | null;
  identicalRequestedSuggested: boolean;
  infeasible: boolean;
  notApproved: boolean;
  earliestAvailable: boolean;
  daysLater: number | null;
  onTrack: boolean;
  blocked: BlockedScheduleCopy | null;
};

const REASON_KEYS: Record<string, string> = {
  NO_ELIGIBLE_WORKER: 'mobile.adminScheduling.reasons.noEligibleWorker',
  MATERIAL_NOT_READY: 'mobile.adminScheduling.reasons.materialNotReady',
  WIP_NOT_READY: 'mobile.adminScheduling.reasons.wipNotReady',
  WIP_DEPENDENCY_CYCLE: 'mobile.adminScheduling.reasons.wipNotReady',
  NO_RESOURCE_CAPACITY: 'mobile.adminScheduling.reasons.capacity',
  NO_SLOT: 'mobile.adminScheduling.reasons.capacity',
  WORKER_OVERLAP: 'mobile.adminScheduling.reasons.overlap',
  CLOSED_DAY: 'mobile.adminScheduling.reasons.closedDay',
  SKILL: 'mobile.adminScheduling.reasons.skill',
};

export function selectUnschedulableReasonKey(reason?: string | null): string {
  if (!reason) return 'mobile.adminScheduling.reasons.unknown';
  return REASON_KEYS[reason] ?? 'mobile.adminScheduling.reasons.unknown';
}

function blockedBodyKey(reason?: string | null): string {
  if (reason === 'NO_ELIGIBLE_WORKER') return 'mobile.adminScheduling.blocked.noEligibleWorkers';
  if (reason === 'MATERIAL_NOT_READY') return 'mobile.adminScheduling.blocked.materials';
  if (reason === 'WIP_NOT_READY' || reason === 'WIP_DEPENDENCY_CYCLE') {
    return 'mobile.adminScheduling.blocked.wip';
  }
  return 'mobile.adminScheduling.blocked.generic';
}

export function ymdOf(iso?: string | null): string | null {
  if (!iso) return null;
  const slice = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null;
}

export function calendarDayDelta(fromIso: string | null, toIso: string | null): number | null {
  const from = ymdOf(fromIso);
  const to = ymdOf(toIso);
  if (!from || !to) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1);
  const b = Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1);
  return Math.round((b - a) / 86_400_000);
}

function sameYmd(a?: string | null, b?: string | null): boolean {
  const left = ymdOf(a);
  const right = ymdOf(b);
  return Boolean(left && right && left === right);
}

export function selectScheduleDates(
  source: ScheduleDateSource,
  stageName?: string,
): ScheduleDatePresentation {
  const requestedIso = source.requestedDeliveryDate ?? null;
  const suggestedIso = source.suggestedDeliveryDate ?? null;
  const committedIso = source.committedDeliveryDate ?? null;
  const earliestIso = source.earliestAvailableDate ?? null;
  const feasible = source.requestedDateFeasible ?? null;
  const unschedulable = Boolean(source.unschedulableReason);
  const hasPlan =
    (source.scheduleStatus === 'PROPOSED' || source.scheduleStatus === 'APPROVED') &&
    Boolean(source.earliestAvailableDate || source.suggestedDeliveryDate);
  const awaiting = source.riskStatus === 'AWAITING_APPROVAL' || (source.scheduleStatus === 'PROPOSED' && hasPlan);
  const blocked: BlockedScheduleCopy | null = unschedulable
    ? {
        titleKey: 'mobile.adminScheduling.blocked.title',
        bodyKey: blockedBodyKey(source.unschedulableReason),
        reasonKey: selectUnschedulableReasonKey(source.unschedulableReason),
        name: stageName,
      }
    : !awaiting && source.requiresAdminEstimateReview && !hasPlan
      ? {
          titleKey: 'mobile.adminScheduling.blocked.title',
          bodyKey: 'mobile.adminScheduling.blocked.estimateReview',
          reasonKey: 'mobile.adminScheduling.reasons.estimateReview',
        }
      : !awaiting &&
          !hasPlan &&
          (source.reasonCode === 'MATERIAL_NOT_READY' || source.unschedulableReason === 'MATERIAL_NOT_READY')
        ? {
            titleKey: 'mobile.adminScheduling.blocked.title',
            bodyKey: 'mobile.adminScheduling.blocked.materials',
            reasonKey: 'mobile.adminScheduling.reasons.materialNotReady',
          }
        : null;

  const identical =
    Boolean(requestedIso && suggestedIso) &&
    sameYmd(requestedIso, suggestedIso) &&
    (!committedIso || sameYmd(requestedIso, committedIso));

  const infeasible = feasible === false && !unschedulable;
  const earliestAvailable = !ymdOf(requestedIso);
  const notApproved = Boolean(
    source.scheduleStatus && source.scheduleStatus !== 'APPROVED' && !committedIso,
  );

  let plan: ScheduleRowPlan = 'expanded';
  if (blocked) plan = 'blocked';
  else if (infeasible) plan = 'infeasible';
  else if (earliestAvailable) plan = 'earliest';
  else if (identical) plan = 'identical';

  const projectedIso = earliestIso ?? suggestedIso;
  const daysLater =
    plan === 'infeasible'
      ? calendarDayDelta(requestedIso, earliestIso ?? suggestedIso)
      : null;

  const onTrack =
    !blocked &&
    !infeasible &&
    feasible !== false &&
    (source.promiseState === 'CONFIRMED' || source.scheduleStatus === 'APPROVED');

  return {
    plan,
    requestedIso,
    suggestedIso,
    committedIso,
    earliestIso,
    projectedIso,
    plannedStartIso: source.plannedStart ?? null,
    plannedEndIso: source.plannedEnd ?? null,
    productionDeadlineIso: source.productionDeadline ?? null,
    materialReadyAtIso: source.materialReadyAt ?? null,
    deliveryBufferWorkingDays:
      source.deliveryBufferWorkingDays != null ? Number(source.deliveryBufferWorkingDays) : null,
    feasible,
    identicalRequestedSuggested: identical,
    infeasible,
    notApproved,
    earliestAvailable,
    daysLater,
    onTrack,
    blocked,
  };
}

export type ConflictSideModel = {
  allocationId: string;
  productionOrderId: string;
  orderNumber: string;
  productName: string | null;
  stageName: string | null;
  start: string;
  end: string;
  priority: string;
  requestedDeliveryDate: string | null;
  committedDeliveryDate: string | null;
  isPinned: boolean;
  taskStatus: string | null;
};

export type ConflictRowModel = {
  id: string;
  type: string;
  employeeId: string | null;
  employeeName: string;
  stageName: string | null;
  productionOrderIds: string[];
  taskA: string | null;
  taskB: string | null;
  startYmd: string;
  overlapStart: string;
  overlapEnd: string;
  overlapMinutes: number;
  allocationA: ConflictSideModel;
  allocationB: ConflictSideModel;
};

function toSide(side: {
  allocationId: string;
  productionOrderId: string;
  orderNumber?: string | null;
  productName?: string | null;
  stageName?: string | null;
  start: string;
  end?: string;
  priority?: string | null;
  requestedDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  isPinned?: boolean;
  taskStatus?: string | null;
  task?: string | null;
}): ConflictSideModel {
  return {
    allocationId: side.allocationId,
    productionOrderId: side.productionOrderId,
    orderNumber: side.orderNumber ?? '',
    productName: side.productName ?? null,
    stageName: side.stageName ?? side.task ?? null,
    start: side.start,
    end: side.end ?? side.start,
    priority: side.priority ?? 'NORMAL',
    requestedDeliveryDate: side.requestedDeliveryDate ?? null,
    committedDeliveryDate: side.committedDeliveryDate ?? null,
    isPinned: Boolean(side.isPinned),
    taskStatus: side.taskStatus ?? null,
  };
}

export function selectConflictClock(iso: string, locale = 'en'): string {
  const typed: Locale = locale === 'ar' || locale === 'he' ? locale : 'en';
  return formatTime(typed, iso);
}

export function selectOverlapDurationParts(minutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function selectConflictTypeKey(type: string): string {
  switch (type) {
    case 'RESOURCE_OVERLAP':
      return 'mobile.adminScheduling.conflicts.typeResource';
    case 'INVALID_SKILL':
      return 'mobile.adminScheduling.conflicts.typeSkill';
    case 'CLOSED_DAY_ALLOCATION':
      return 'mobile.adminScheduling.conflicts.typeClosed';
    case 'INACTIVE_WORKER_ALLOCATION':
      return 'mobile.adminScheduling.conflicts.typeInactive';
    case 'LOCKED_CONFLICT':
      return 'mobile.adminScheduling.conflicts.typeLocked';
    default:
      return 'mobile.adminScheduling.conflicts.typeOverlap';
  }
}

export function selectShowPriority(a: string, b: string): boolean {
  const left = a.toUpperCase();
  const right = b.toUpperCase();
  if (left !== right) return true;
  return left === 'HIGH' || left === 'URGENT';
}

export function selectConflictRows(
  pairs:
    | Array<{
        conflictId?: string;
        type?: string;
        worker?: { id: string; name: string } | null;
        employeeId?: string;
        employeeName?: string;
        overlapStart?: string;
        overlapEnd?: string;
        overlapMinutes?: number;
        allocationA?: Parameters<typeof toSide>[0];
        allocationB?: Parameters<typeof toSide>[0];
        a?: Parameters<typeof toSide>[0];
        b?: Parameters<typeof toSide>[0];
      }>
    | undefined,
): ConflictRowModel[] {
  if (!pairs?.length) return [];
  return pairs.map((pair) => {
    const allocationA = toSide(pair.allocationA ?? pair.a!);
    const allocationB = toSide(pair.allocationB ?? pair.b!);
    const overlapStart = pair.overlapStart ?? allocationA.start;
    const overlapEnd = pair.overlapEnd ?? allocationA.end;
    const overlapMinutes =
      pair.overlapMinutes ??
      Math.max(0, Math.round((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 60_000));
    return {
      id: pair.conflictId ?? `${allocationA.allocationId}:${allocationB.allocationId}`,
      type: pair.type ?? 'WORKER_OVERLAP',
      employeeId: pair.worker?.id ?? pair.employeeId ?? null,
      employeeName: pair.worker?.name ?? pair.employeeName ?? '',
      stageName: allocationA.stageName ?? allocationB.stageName,
      productionOrderIds: [...new Set([allocationA.productionOrderId, allocationB.productionOrderId])],
      taskA: allocationA.stageName,
      taskB: allocationB.stageName,
      startYmd: String(overlapStart).slice(0, 10),
      overlapStart,
      overlapEnd,
      overlapMinutes,
      allocationA,
      allocationB,
    };
  });
}

/** Map overlap PO ids to factory numbers. Drop unknown ids — never show allocation UUIDs. */
export function selectConflictOrderLabels(
  ids: string[],
  cards: Array<{ productionOrderId: string; number: string }>,
): string[] {
  const byId = new Map(cards.map((card) => [card.productionOrderId, card.number]));
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const number = byId.get(id);
    if (!number || seen.has(number)) continue;
    seen.add(number);
    labels.push(number);
  }
  return labels;
}

export function selectUniqueConflictProductionOrderIds(
  rows: Array<{ productionOrderIds: string[] }>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const id of row.productionOrderIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Client filter for worker-overlap rows — name, tasks, and factory PO numbers. */
export function filterConflictRows(
  rows: ConflictRowModel[],
  query: string,
  orderLabels: Array<{ productionOrderId: string; number: string }>,
): ConflictRowModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const labels = [
      ...selectConflictOrderLabels(row.productionOrderIds, orderLabels),
      row.allocationA.orderNumber,
      row.allocationB.orderNumber,
    ];
    const haystack = [row.employeeName, row.taskA, row.taskB, row.stageName, ...labels]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
