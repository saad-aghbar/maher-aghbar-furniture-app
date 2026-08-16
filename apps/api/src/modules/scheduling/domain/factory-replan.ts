/**
 * Factory replan candidate policy after calendar / capacity changes.
 * Does not pack every day to 100%. Does not replace comparePriority.
 */
import type { CanonicalScheduleStatus, ScheduleRiskClassification } from './at-risk';
import { CapacityTracker } from './capacity';
import { comparePriority } from './priority-fairness';
import { resourceCapacityKey } from './schedule-planner';
import type { OccupancyInterval, PrioritySortItem } from './types';
import { addDaysYmd, parseYmd, type WorkingCalendar } from './working-calendar';

export type CapacityDelta = 'increase' | 'decrease' | 'none';

export type FactoryReplanUrgency =
  | 'late'
  | 'atRisk'
  | 'blockedRecoverable'
  | 'forward'
  | 'decreaseUnpinned';

export const FACTORY_REPLAN_HORIZON_DAYS = 90;

export type FactoryReplanCandidate = {
  productionOrderId: string;
  number: string;
  urgency: FactoryReplanUrgency;
  priority: PrioritySortItem;
};

export type PinnedUnavailableIssue = {
  productionOrderId: string;
  allocationId: string;
  orderNumber: string;
  ymd: string;
};

export type FactoryReplanAllocation = {
  id: string;
  plannedStart: Date;
  plannedEnd: Date;
  isPinned: boolean;
  manuallyAdjusted?: boolean;
  taskStatus?: string | null;
};

export type FactoryReplanOrderInput = {
  productionOrderId: string;
  number: string;
  classification: Pick<
    ScheduleRiskClassification,
    'primaryStatus' | 'recoverableAutomatically'
  >;
  planningMode?: string | null;
  requestedDateFeasible?: boolean | null;
  hasPromiseDate: boolean;
  priority: PrioritySortItem;
  allocations: FactoryReplanAllocation[];
};

const IMMUTABLE_TASK = new Set(['COMPLETED', 'IN_PROGRESS']);

const URGENCY_RANK: Record<FactoryReplanUrgency, number> = {
  late: 0,
  atRisk: 1,
  blockedRecoverable: 2,
  forward: 3,
  decreaseUnpinned: 4,
};

export function ymdInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function workingMinutesOnYmd(calendar: WorkingCalendar, ymd: string): number {
  return calendar.intervalsForLocalYmd(ymd).reduce(
    (sum, iv) => sum + (iv.end.getTime() - iv.start.getTime()) / 60_000,
    0,
  );
}

export function classifyMinutesDelta(beforeMinutes: number, afterMinutes: number): CapacityDelta {
  if (afterMinutes > beforeMinutes + 0.5) return 'increase';
  if (afterMinutes < beforeMinutes - 0.5) return 'decrease';
  return 'none';
}

export function classifySettingsDelta(
  before: WorkingCalendar,
  after: WorkingCalendar,
  fromYmd: string,
): CapacityDelta {
  let beforeSum = 0;
  let afterSum = 0;
  let ymd = fromYmd;
  for (let i = 0; i < 14; i += 1) {
    beforeSum += workingMinutesOnYmd(before, ymd);
    afterSum += workingMinutesOnYmd(after, ymd);
    ymd = addDaysYmd(ymd, 1);
  }
  return classifyMinutesDelta(beforeSum, afterSum);
}

export function factoryReplanHorizonYmd(
  changedYmd: string | null,
  latestAllocationEnd: Date | null,
  timeZone: string,
  now = new Date(),
): { fromYmd: string; toYmd: string } {
  const fromYmd = changedYmd && parseYmd(changedYmd) ? changedYmd : ymdInTimezone(now, timeZone);
  const plus90 = addDaysYmd(fromYmd, FACTORY_REPLAN_HORIZON_DAYS);
  const allocYmd = latestAllocationEnd ? ymdInTimezone(latestAllocationEnd, timeZone) : fromYmd;
  return { fromYmd, toYmd: allocYmd > plus90 ? allocYmd : plus90 };
}

export function uncoveredMinutes(
  start: Date,
  end: Date,
  intervals: Array<{ start: Date; end: Date }>,
): number {
  if (end.getTime() <= start.getTime()) return 0;
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  let cursor = start.getTime();
  const endMs = end.getTime();
  let uncovered = 0;
  for (const iv of sorted) {
    const ivStart = iv.start.getTime();
    const ivEnd = iv.end.getTime();
    if (ivEnd <= cursor) continue;
    if (ivStart >= endMs) break;
    if (ivStart > cursor) uncovered += Math.min(endMs, ivStart) - cursor;
    cursor = Math.max(cursor, Math.min(endMs, ivEnd));
    if (cursor >= endMs) break;
  }
  if (cursor < endMs) uncovered += endMs - cursor;
  return uncovered / 60_000;
}

export function allocationHasUnavailableWindow(
  calendar: WorkingCalendar,
  start: Date,
  end: Date,
): { invalid: boolean; ymds: string[] } {
  const fromYmd = ymdInTimezone(start, calendar.timezone);
  const toYmd = ymdInTimezone(new Date(Math.max(start.getTime(), end.getTime() - 1)), calendar.timezone);
  const ymds: string[] = [];
  let ymd = fromYmd;
  for (let guard = 0; guard < 400 && ymd <= toYmd; guard += 1) {
    const { start: dayStart, endExclusive } = calendar.localRangeBounds(ymd, ymd);
    const clipStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
    const clipEnd = new Date(Math.min(end.getTime(), endExclusive.getTime()));
    if (clipEnd.getTime() > clipStart.getTime()) {
      const intervals = calendar.intervalsForLocalYmd(ymd);
      if (intervals.length === 0) {
        ymds.push(ymd);
      } else {
        const envelopeStart = intervals.reduce(
          (min, iv) => (iv.start.getTime() < min.getTime() ? iv.start : min),
          intervals[0]!.start,
        );
        const envelopeEnd = intervals.reduce(
          (max, iv) => (iv.end.getTime() > max.getTime() ? iv.end : max),
          intervals[0]!.end,
        );
        const before = uncoveredMinutes(clipStart, new Date(Math.min(clipEnd.getTime(), envelopeStart.getTime())), []);
        const after = uncoveredMinutes(new Date(Math.max(clipStart.getTime(), envelopeEnd.getTime())), clipEnd, []);
        if (before + after > 1) ymds.push(ymd);
      }
    }
    ymd = addDaysYmd(ymd, 1);
  }
  return { invalid: ymds.length > 0, ymds };
}

export function isImmutableTaskStatus(status?: string | null): boolean {
  return IMMUTABLE_TASK.has(String(status ?? ''));
}

export function selectIncreaseUrgency(input: {
  primaryStatus: CanonicalScheduleStatus;
  recoverableAutomatically: boolean;
  hasPromiseDate: boolean;
  planningMode?: string | null;
}): FactoryReplanUrgency | 'skip' {
  if (input.primaryStatus === 'LATE') return 'late';
  if (input.primaryStatus === 'AT_RISK') return 'atRisk';
  if (input.primaryStatus === 'BLOCKED' && input.recoverableAutomatically) return 'blockedRecoverable';
  if (!input.hasPromiseDate || input.planningMode === 'FORWARD') return 'forward';
  return 'skip';
}

export function selectIncreaseCandidates(orders: FactoryReplanOrderInput[]): FactoryReplanCandidate[] {
  const out: FactoryReplanCandidate[] = [];
  for (const order of orders) {
    const urgency = selectIncreaseUrgency({
      primaryStatus: order.classification.primaryStatus,
      recoverableAutomatically: order.classification.recoverableAutomatically,
      hasPromiseDate: order.hasPromiseDate,
      planningMode: order.planningMode,
    });
    if (urgency === 'skip') continue;
    out.push({
      productionOrderId: order.productionOrderId,
      number: order.number,
      urgency,
      priority: order.priority,
    });
  }
  return out.sort(compareFactoryReplanCandidates);
}

export function selectDecreaseCandidates(
  orders: FactoryReplanOrderInput[],
  calendar: WorkingCalendar,
): { candidates: FactoryReplanCandidate[]; pinnedIssues: PinnedUnavailableIssue[] } {
  const candidates: FactoryReplanCandidate[] = [];
  const pinnedIssues: PinnedUnavailableIssue[] = [];
  const seen = new Set<string>();

  for (const order of orders) {
    for (const alloc of order.allocations) {
      if (isImmutableTaskStatus(alloc.taskStatus)) continue;
      const { invalid, ymds } = allocationHasUnavailableWindow(
        calendar,
        alloc.plannedStart,
        alloc.plannedEnd,
      );
      if (!invalid) continue;
      if (alloc.isPinned || alloc.manuallyAdjusted) {
        pinnedIssues.push({
          productionOrderId: order.productionOrderId,
          allocationId: alloc.id,
          orderNumber: order.number,
          ymd: ymds[0] ?? ymdInTimezone(alloc.plannedStart, calendar.timezone),
        });
        continue;
      }
      if (seen.has(order.productionOrderId)) continue;
      seen.add(order.productionOrderId);
      candidates.push({
        productionOrderId: order.productionOrderId,
        number: order.number,
        urgency: 'decreaseUnpinned',
        priority: order.priority,
      });
    }
  }

  return { candidates: candidates.sort(compareFactoryReplanCandidates), pinnedIssues };
}

export function compareFactoryReplanCandidates(
  a: FactoryReplanCandidate,
  b: FactoryReplanCandidate,
): number {
  const ur = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (ur !== 0) return ur;
  return comparePriority(a.priority, b.priority);
}

export function countPinnedIssuesByYmd(
  issues: PinnedUnavailableIssue[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const issue of issues) {
    out[issue.ymd] = (out[issue.ymd] ?? 0) + 1;
  }
  return out;
}

export function listPinnedOnUnavailableCalendar(
  allocations: Array<
    FactoryReplanAllocation & { productionOrderId: string; orderNumber: string }
  >,
  calendar: WorkingCalendar,
): PinnedUnavailableIssue[] {
  const issues: PinnedUnavailableIssue[] = [];
  for (const alloc of allocations) {
    if (!alloc.isPinned && !alloc.manuallyAdjusted) continue;
    if (isImmutableTaskStatus(alloc.taskStatus)) continue;
    const { invalid, ymds } = allocationHasUnavailableWindow(
      calendar,
      alloc.plannedStart,
      alloc.plannedEnd,
    );
    if (!invalid) continue;
    for (const ymd of ymds) {
      issues.push({
        productionOrderId: alloc.productionOrderId,
        allocationId: alloc.id,
        orderNumber: alloc.orderNumber,
        ymd,
      });
    }
  }
  return issues;
}

export class OccupancyCollisionError extends Error {
  readonly collisions: OccupancyInterval[];

  constructor(
    readonly productionOrderId: string,
    collisions: OccupancyInterval[],
  ) {
    super(`OCCUPANCY_COLLISION:${productionOrderId}`);
    this.name = 'OccupancyCollisionError';
    this.collisions = collisions;
  }
}

/** Merge overlapping intervals per worker/resource key so planner tryReserve cannot drop occupied time. */
export function unionOccupancyIntervals(intervals: OccupancyInterval[]): OccupancyInterval[] {
  const byKey = new Map<string, OccupancyInterval[]>();
  for (const iv of intervals) {
    const list = byKey.get(iv.employeeId) ?? [];
    list.push({ ...iv });
    byKey.set(iv.employeeId, list);
  }
  const out: OccupancyInterval[] = [];
  for (const list of byKey.values()) {
    list.sort(
      (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
    );
    let cur = list[0]!;
    for (let i = 1; i < list.length; i += 1) {
      const next = list[i]!;
      if (next.start.getTime() < cur.end.getTime()) {
        if (next.end.getTime() > cur.end.getTime()) {
          cur = { ...cur, end: next.end };
        }
      } else {
        out.push(cur);
        cur = next;
      }
    }
    out.push(cur);
  }
  return out;
}

export function stripOccupancyForOrder(
  intervals: OccupancyInterval[],
  productionOrderId: string,
): OccupancyInterval[] {
  return intervals.filter((iv) => iv.productionOrderId !== productionOrderId);
}

export function plannedAllocationsToOccupancy(
  productionOrderId: string,
  allocs: Array<{
    id?: string | null;
    employeeId?: string | null;
    resourceSlot?: number | null;
    stageDefinitionId?: string | null;
    productionTaskId?: string | null;
    plannedStart: Date;
    plannedEnd: Date;
  }>,
): OccupancyInterval[] {
  const out: OccupancyInterval[] = [];
  for (const a of allocs) {
    const id = a.id ?? a.productionTaskId ?? `${productionOrderId}:${a.plannedStart.toISOString()}`;
    if (a.employeeId) {
      out.push({
        employeeId: a.employeeId,
        start: a.plannedStart,
        end: a.plannedEnd,
        allocationId: id,
        productionOrderId,
      });
    }
    if (a.resourceSlot != null && a.stageDefinitionId) {
      out.push({
        employeeId: resourceCapacityKey(a.stageDefinitionId, a.resourceSlot),
        start: a.plannedStart,
        end: a.plannedEnd,
        allocationId: `${id}:res`,
        productionOrderId,
      });
    }
  }
  return out;
}

/** Map generate/getOrderSchedule allocation DTOs onto occupancy (employee.id or employeeId). */
export function occupancyFromGeneratedAllocations(
  productionOrderId: string,
  allocs: Array<{
    id?: string | null;
    employeeId?: string | null;
    employee?: { id?: string | null } | null;
    resourceSlot?: number | null;
    stageDefinitionId?: string | null;
    productionTask?: { stageDefinitionId?: string | null } | null;
    task?: { stageDefinitionId?: string | null } | null;
    plannedStart: Date | string;
    plannedEnd: Date | string;
  }>,
): OccupancyInterval[] {
  return plannedAllocationsToOccupancy(
    productionOrderId,
    allocs.map((a) => ({
      id: a.id,
      employeeId: a.employeeId ?? a.employee?.id ?? null,
      resourceSlot: a.resourceSlot ?? null,
      stageDefinitionId:
        a.stageDefinitionId ??
        a.productionTask?.stageDefinitionId ??
        a.task?.stageDefinitionId ??
        null,
      plannedStart: new Date(a.plannedStart),
      plannedEnd: new Date(a.plannedEnd),
    })),
  );
}

export function findOccupancyCollisions(
  occupancy: OccupancyInterval[],
  candidate: OccupancyInterval[],
): OccupancyInterval[] {
  const tracker = new CapacityTracker([]);
  for (const iv of occupancy) tracker.forceReserve(iv);
  return candidate.filter((iv) =>
    tracker.hasOverlap(iv.employeeId, iv.start, iv.end, iv.allocationId),
  );
}

export function allocationPlanKey(a: {
  productionTaskId?: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  employeeId?: string | null;
  resourceSlot?: number | null;
}): string {
  return [
    a.productionTaskId ?? '',
    a.plannedStart.getTime(),
    a.plannedEnd.getTime(),
    a.employeeId ?? '',
    a.resourceSlot ?? '',
  ].join('|');
}

export function plannedAllocationsMatch(
  prior: Array<{
    productionTaskId?: string | null;
    plannedStart: Date;
    plannedEnd: Date;
    employeeId?: string | null;
    resourceSlot?: number | null;
  }>,
  next: Array<{
    productionTaskId?: string | null;
    plannedStart: Date;
    plannedEnd: Date;
    employeeId?: string | null;
    resourceSlot?: number | null;
  }>,
): boolean {
  if (prior.length !== next.length) return false;
  const priorSet = new Set(prior.map(allocationPlanKey));
  return next.every((a) => priorSet.has(allocationPlanKey(a)));
}

/** Stable overlap identity (not allocation ids) so regenerate does not look like a new conflict. */
export function operationalOverlapKey(c: {
  type: string;
  overlapStart: Date | string;
  overlapEnd: Date | string;
  worker?: { id?: string | null } | null;
  resource?: { stageDefinitionId?: string | null; slot?: number | null } | null;
  allocationA: { productionOrderId: string };
  allocationB: { productionOrderId: string };
}): string {
  const orders = [c.allocationA.productionOrderId, c.allocationB.productionOrderId].sort();
  const wr =
    c.worker?.id ??
    (c.resource?.stageDefinitionId != null && c.resource.slot != null
      ? `${c.resource.stageDefinitionId}:${c.resource.slot}`
      : '');
  const start = c.overlapStart instanceof Date ? c.overlapStart.toISOString() : c.overlapStart;
  const end = c.overlapEnd instanceof Date ? c.overlapEnd.toISOString() : c.overlapEnd;
  return `${c.type}:${wr}:${orders[0]}:${orders[1]}:${start}:${end}`;
}
