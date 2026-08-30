/**
 * Pair-level conflict resolution helpers.
 * Uses existing CapacityTracker / eligibility / comparePriority.
 * Does not change schedule-planner placement.
 */
import { CapacityTracker } from './capacity';
import type { DetectedConflict, ConflictAllocationInput, ConflictSideView } from './conflict-detector';
import { comparePriority } from './priority-fairness';
import type { OccupancyInterval, Priority, WorkerCandidate } from './types';
import { listEligibleWorkers } from './worker-assignment';
import type { WorkingCalendar } from './working-calendar';

export type ResolveAction = 'REASSIGNED' | 'RESCHEDULED' | 'ALREADY_RESOLVED';

export type ResolveFailCode =
  | 'ALREADY_RESOLVED'
  | 'MANUAL_LOCKED'
  | 'WOULD_MISS_COMMITMENT'
  | 'NO_ALTERNATIVE'
  | 'NOT_FOUND';

export type ResolvePlacement = {
  action: Exclude<ResolveAction, 'ALREADY_RESOLVED'>;
  employeeId: string;
  start: Date;
  end: Date;
};

const HARD_STATUS = new Set(['COMPLETED']);
const TIME_LOCKED_STATUS = new Set(['IN_PROGRESS', 'BLOCKED']);

/** Completed, or an admin explicitly pinned the slot. Planner `isPinned` alone is not a lock. */
export function isHardLocked(side: {
  isPinned?: boolean;
  manuallyAdjusted?: boolean | null;
  taskStatus: string | null | undefined;
}): boolean {
  if (HARD_STATUS.has(String(side.taskStatus ?? ''))) return true;
  return Boolean(side.manuallyAdjusted && side.isPinned);
}

/** In-progress / blocked: keep the clock, but Resolve may reassign the worker. */
export function isTimeLocked(side: { taskStatus: string | null | undefined }): boolean {
  return TIME_LOCKED_STATUS.has(String(side.taskStatus ?? ''));
}

export function isAllocationFixed(side: {
  isPinned?: boolean;
  manuallyAdjusted?: boolean | null;
  taskStatus: string | null | undefined;
}): boolean {
  return isHardLocked(side) || isTimeLocked(side);
}

export function toPriorityItem(side: ConflictSideView) {
  return {
    id: side.productionOrderId,
    customerId: side.customerId || side.productionOrderId,
    isPinned: side.isPinned || isHardLocked(side) || isTimeLocked(side),
    priority: side.priority,
    committedDeliveryDate: side.committedDeliveryDate,
    requestedDeliveryDate: side.requestedDeliveryDate,
    createdAt: side.createdAt,
  };
}

export function pickMovableSides(conflict: DetectedConflict): {
  keeper: ConflictSideView;
  movable: ConflictSideView;
  sameWindowOnly: boolean;
} | { bothFixed: true } {
  const aHard = isHardLocked(conflict.allocationA);
  const bHard = isHardLocked(conflict.allocationB);
  if (aHard && bHard) return { bothFixed: true };
  if (aHard) {
    return {
      keeper: conflict.allocationA,
      movable: conflict.allocationB,
      sameWindowOnly: isTimeLocked(conflict.allocationB),
    };
  }
  if (bHard) {
    return {
      keeper: conflict.allocationB,
      movable: conflict.allocationA,
      sameWindowOnly: isTimeLocked(conflict.allocationA),
    };
  }
  const cmp = comparePriority(toPriorityItem(conflict.allocationA), toPriorityItem(conflict.allocationB));
  const keeper = cmp <= 0 ? conflict.allocationA : conflict.allocationB;
  const movable = cmp <= 0 ? conflict.allocationB : conflict.allocationA;
  return { keeper, movable, sameWindowOnly: isTimeLocked(movable) };
}

export function sortConflictsForResolveAll(conflicts: DetectedConflict[]): DetectedConflict[] {
  return [...conflicts].sort((x, y) => {
    const pickX = pickMovableSides(x);
    const pickY = pickMovableSides(y);
    const keeperX = 'bothFixed' in pickX ? x.allocationA : pickX.keeper;
    const keeperY = 'bothFixed' in pickY ? y.allocationA : pickY.keeper;
    const c = comparePriority(toPriorityItem(keeperX), toPriorityItem(keeperY));
    return c !== 0 ? c : x.conflictId.localeCompare(y.conflictId);
  });
}

export function missesCommitment(end: Date, committed: Date | null | undefined): boolean {
  if (!committed) return false;
  return end.getTime() > committed.getTime();
}

function occupancyWithout(
  occupancy: OccupancyInterval[],
  ignoreAllocationIds: Set<string>,
): OccupancyInterval[] {
  return occupancy.filter((iv) => !iv.allocationId || !ignoreAllocationIds.has(iv.allocationId));
}

export function findResolutionPlacement(input: {
  movable: ConflictAllocationInput;
  keeper: ConflictAllocationInput;
  workers: WorkerCandidate[];
  occupancy: OccupancyInterval[];
  calendar: WorkingCalendar;
  now: Date;
  horizon?: Date;
  /** In-progress work: reassign in the same window only — do not move the clock. */
  sameWindowOnly?: boolean;
}): ResolvePlacement | { fail: Extract<ResolveFailCode, 'NO_ALTERNATIVE'> } {
  const { movable, keeper, workers, calendar, now } = input;
  const duration = Math.max(
    1,
    movable.estimatedMinutes ??
      Math.round((movable.plannedEnd.getTime() - movable.plannedStart.getTime()) / 60_000),
  );
  const stageDefinitionId = movable.stageDefinitionId;
  const eligible = listEligibleWorkers({
    workers,
    departmentCode: null,
    stageDefinitionId,
  }).filter((w) => w.isActive);
  if (eligible.length === 0) return { fail: 'NO_ALTERNATIVE' };

  const ignore = new Set<string>([movable.id]);
  const tracker = new CapacityTracker(occupancyWithout(input.occupancy, ignore));
  if (keeper.employeeId) {
    tracker.forceReserve({
      employeeId: keeper.employeeId,
      start: keeper.plannedStart,
      end: keeper.plannedEnd,
      allocationId: keeper.id,
    });
  }

  const horizon =
    input.horizon ??
    new Date(Math.max(now.getTime(), movable.plannedEnd.getTime()) + 180 * 24 * 60 * 60 * 1000);
  const sameStart = movable.plannedStart;
  const sameEnd = movable.plannedEnd;
  const sameWindowInPast = sameStart.getTime() < now.getTime();

  const notBefore = (instant: Date): Date => {
    const next = calendar.nextWorkingInstant(instant);
    return next.getTime() >= now.getTime() ? next : new Date(now.getTime());
  };

  // A — another eligible worker in the same window (never a past window unless IN_PROGRESS)
  if (!sameWindowInPast || input.sameWindowOnly) {
    for (const worker of eligible) {
      if (worker.id === movable.employeeId) continue;
      if (!tracker.hasOverlap(worker.id, sameStart, sameEnd)) {
        return { action: 'REASSIGNED', employeeId: worker.id, start: sameStart, end: sameEnd };
      }
    }
  }

  if (input.sameWindowOnly) return { fail: 'NO_ALTERNATIVE' };

  // B — same worker, later valid slot (never a historical next interval)
  if (movable.employeeId && eligible.some((w) => w.id === movable.employeeId)) {
    const from = notBefore(sameEnd);
    const fit = tracker.earliestFit(
      movable.employeeId,
      from,
      duration,
      (instant) => calendar.nextWorkingInstant(instant),
      (start, minutes) => calendar.addWorkingMinutes(start, minutes),
      horizon,
    );
    if (fit) {
      return { action: 'RESCHEDULED', employeeId: movable.employeeId, start: fit.start, end: fit.end };
    }
  }

  // C — any eligible worker + valid time from the scheduling floor
  let best: ResolvePlacement | null = null;
  for (const worker of eligible) {
    const fit = tracker.earliestFit(
      worker.id,
      now,
      duration,
      (instant) => calendar.nextWorkingInstant(instant),
      (start, minutes) => calendar.addWorkingMinutes(start, minutes),
      horizon,
    );
    if (!fit) continue;
    const action: ResolvePlacement['action'] =
      worker.id === movable.employeeId ? 'RESCHEDULED' : 'REASSIGNED';
    const candidate: ResolvePlacement = {
      action,
      employeeId: worker.id,
      start: fit.start,
      end: fit.end,
    };
    if (
      !best ||
      candidate.start.getTime() < best.start.getTime() ||
      (candidate.start.getTime() === best.start.getTime() &&
        candidate.employeeId.localeCompare(best.employeeId) < 0)
    ) {
      best = candidate;
    }
  }
  if (best) return best;
  return { fail: 'NO_ALTERNATIVE' };
}

/** Duration in minutes — attached when loading for resolve. */
export type ConflictAllocationInputWithDuration = ConflictAllocationInput & {
  estimatedMinutes?: number;
};

export function compareResolvePriority(
  a: { priority: Priority; committedDeliveryDate: Date | null; requestedDeliveryDate: Date | null; createdAt: Date; id: string; isPinned: boolean; customerId: string },
  b: typeof a,
): number {
  return comparePriority(a, b);
}
