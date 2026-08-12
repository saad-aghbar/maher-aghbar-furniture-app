import type { OccupancyInterval } from './types';

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export class CapacityTracker {
  private readonly byEmployee = new Map<string, OccupancyInterval[]>();

  constructor(initial: OccupancyInterval[] = []) {
    for (const iv of initial) {
      this.reserve(iv);
    }
  }

  getOccupancy(employeeId: string): OccupancyInterval[] {
    return [...(this.byEmployee.get(employeeId) ?? [])];
  }

  loadedMinutes(employeeId: string): number {
    return (this.byEmployee.get(employeeId) ?? []).reduce(
      (sum, iv) => sum + Math.max(0, (iv.end.getTime() - iv.start.getTime()) / 60_000),
      0,
    );
  }

  findOverlaps(
    employeeId: string,
    start: Date,
    end: Date,
    ignoreAllocationId?: string,
  ): OccupancyInterval[] {
    return (this.byEmployee.get(employeeId) ?? []).filter((iv) => {
      if (ignoreAllocationId && iv.allocationId === ignoreAllocationId) return false;
      return overlaps(start, end, iv.start, iv.end);
    });
  }

  hasOverlap(
    employeeId: string,
    start: Date,
    end: Date,
    ignoreAllocationId?: string,
  ): boolean {
    return this.findOverlaps(employeeId, start, end, ignoreAllocationId).length > 0;
  }

  /** Reserve a slot. Throws if it overlaps an existing reservation. */
  reserve(interval: OccupancyInterval): void {
    if (interval.end.getTime() <= interval.start.getTime()) {
      throw new Error('Invalid occupancy interval: end must be after start');
    }
    if (
      this.hasOverlap(
        interval.employeeId,
        interval.start,
        interval.end,
        interval.allocationId,
      )
    ) {
      throw new Error(
        `Capacity conflict for employee ${interval.employeeId} at ${interval.start.toISOString()}`,
      );
    }
    const list = this.byEmployee.get(interval.employeeId) ?? [];
    list.push({ ...interval });
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
    this.byEmployee.set(interval.employeeId, list);
  }

  tryReserve(interval: OccupancyInterval): boolean {
    try {
      this.reserve(interval);
      return true;
    } catch {
      return false;
    }
  }

  release(employeeId: string, allocationId: string): void {
    const list = this.byEmployee.get(employeeId);
    if (!list) return;
    this.byEmployee.set(
      employeeId,
      list.filter((iv) => iv.allocationId !== allocationId),
    );
  }

  /** Flat copy of all reserved intervals. */
  snapshot(): OccupancyInterval[] {
    return [...this.byEmployee.values()].flat().map((iv) => ({ ...iv }));
  }

  /** Independent tracker with the same reservations. */
  clone(): CapacityTracker {
    return new CapacityTracker(this.snapshot());
  }

  /** Earliest start >= `from` where `[start, start+durationMinutes]` fits without overlap. */
  earliestFit(
    employeeId: string,
    from: Date,
    durationMinutes: number,
    nextCandidate: (instant: Date) => Date,
    addDuration: (start: Date, minutes: number) => Date,
    horizon: Date,
  ): { start: Date; end: Date } | null {
    let cursor = nextCandidate(from);
    for (let i = 0; i < 10_000; i++) {
      if (cursor.getTime() > horizon.getTime()) return null;
      const end = addDuration(cursor, durationMinutes);
      if (!this.hasOverlap(employeeId, cursor, end)) {
        return { start: cursor, end };
      }
      const blockers = this.findOverlaps(employeeId, cursor, end);
      const nextEnd = blockers.reduce(
        (max, b) => Math.max(max, b.end.getTime()),
        cursor.getTime(),
      );
      cursor = nextCandidate(new Date(nextEnd));
    }
    return null;
  }
}
