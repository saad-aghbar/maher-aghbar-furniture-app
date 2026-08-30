/**
 * Canonical factory scheduling floor.
 * PAST = historical truth. New movable incomplete work may not start before this instant.
 */
import type { WorkingCalendar } from './working-calendar';

export type AllocationFloorClass =
  | 'PAST_COMPLETED'
  | 'IN_PROGRESS'
  | 'STALE'
  | 'FUTURE'
  | 'MANUAL_ATTENTION';

export type FloorAllocationInput = {
  plannedStart: Date;
  isPinned?: boolean;
  manuallyAdjusted?: boolean | null;
  taskStatus?: string | null;
};

export type PastFloorViolation = {
  allocationKey?: string;
  stageCode?: string;
  plannedStart: Date;
  class: AllocationFloorClass;
};

export class PastFloorViolationError extends Error {
  readonly code = 'PAST_ALLOCATION_FLOOR';
  constructor(public readonly violations: PastFloorViolation[]) {
    super(
      `Incomplete movable work cannot start before the scheduling floor (${violations.length} violation(s)).`,
    );
    this.name = 'PastFloorViolationError';
  }
}

const LOCKED_IN_PLACE = new Set(['COMPLETED', 'IN_PROGRESS', 'BLOCKED']);

export function laterDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/** Current factory-local instant if working; otherwise the next legal working instant. */
export function resolveSchedulingFloor(calendar: WorkingCalendar, now: Date = new Date()): Date {
  return calendar.nextWorkingInstant(now);
}

/**
 * Planner `ctx.now`: never earlier than the canonical floor.
 * A later `fromDate` (admin “move to day”) is allowed.
 */
export function resolvePlannerNow(
  calendar: WorkingCalendar,
  now: Date = new Date(),
  fromDate?: Date | null,
): Date {
  const floor = resolveSchedulingFloor(calendar, now);
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    return laterDate(floor, fromDate);
  }
  return floor;
}

export function isLockedInPlaceTask(taskStatus?: string | null): boolean {
  return LOCKED_IN_PLACE.has(String(taskStatus ?? '').toUpperCase());
}

export function classifyAllocationForFloor(
  input: FloorAllocationInput & { floor: Date },
): AllocationFloorClass {
  const status = String(input.taskStatus ?? '').toUpperCase();
  if (status === 'COMPLETED') return 'PAST_COMPLETED';
  if (status === 'IN_PROGRESS' || status === 'BLOCKED') return 'IN_PROGRESS';

  if (input.plannedStart.getTime() >= input.floor.getTime()) return 'FUTURE';

  const preserved = Boolean(input.isPinned || input.manuallyAdjusted);
  if (preserved) return 'MANUAL_ATTENTION';
  return 'STALE';
}

/** Incomplete movable (not IN_PROGRESS / not preserved pin) with plannedStart < floor. */
export function allocationViolatesSchedulingFloor(
  input: FloorAllocationInput & { floor: Date },
): boolean {
  return classifyAllocationForFloor(input) === 'STALE';
}

export function findPastIncompleteViolations(
  allocations: Array<
    FloorAllocationInput & { allocationKey?: string; stageCode?: string }
  >,
  floor: Date,
): PastFloorViolation[] {
  const out: PastFloorViolation[] = [];
  for (const alloc of allocations) {
    const cls = classifyAllocationForFloor({ ...alloc, floor });
    if (cls !== 'STALE') continue;
    out.push({
      allocationKey: alloc.allocationKey,
      stageCode: alloc.stageCode,
      plannedStart: alloc.plannedStart,
      class: cls,
    });
  }
  return out;
}

export function assertNoPastIncompleteAllocations(
  allocations: Array<FloorAllocationInput & { allocationKey?: string; stageCode?: string }>,
  floor: Date,
): void {
  const violations = findPastIncompleteViolations(allocations, floor);
  if (violations.length > 0) {
    throw new PastFloorViolationError(violations);
  }
}

export function isHistoricalCapacityIncrease(
  affectedYmd: string | null | undefined,
  floorYmd: string,
): boolean {
  if (!affectedYmd) return false;
  return affectedYmd < floorYmd;
}
