/**
 * Production day lens — VIEW/FILTER ONLY.
 *
 * Planned = manual factory plan intervals overlapping factory-local day.
 * Actual = real event timestamps on that factory-local day.
 *
 * NEVER mutates schedule, lifecycle, assignments, or delivery.
 * Does NOT touch productionBoardBucketWhere (Phase A).
 */

import { Prisma } from '@maher/database';
import { DEFAULT_FACTORY_TIMEZONE } from '../scheduling/domain/dealer-request-lead';
import { ymdInTimezone } from '../scheduling/domain/factory-replan';
import {
  WorkingCalendar,
  parseYmd,
  addDaysYmd,
} from '../scheduling/domain/working-calendar';

export type ProductionDateMode = 'planned' | 'actual';

export type FactoryDayBounds = {
  onDate: string;
  timezone: string;
  start: Date;
  endExclusive: Date;
  factoryTodayYmd: string;
  isToday: boolean;
  isFuture: boolean;
};

/** Minimal calendar for day bounds only (exceptions unused for lens bounds). */
export function factoryCalendarForTimezone(timezone: string): WorkingCalendar {
  return new WorkingCalendar({
    timezone: timezone.trim() || DEFAULT_FACTORY_TIMEZONE,
    workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
    shiftStart: '00:00',
    shiftEnd: '23:59',
    breaks: [],
    exceptions: [],
  });
}

export function resolveFactoryDayBounds(
  onDate: string,
  timezone: string,
  now: Date = new Date(),
): FactoryDayBounds {
  const ymd = parseYmd(onDate) ? onDate : ymdInTimezone(now, timezone);
  const calendar = factoryCalendarForTimezone(timezone);
  const { start, endExclusive } = calendar.localRangeBounds(ymd, ymd);
  const factoryTodayYmd = ymdInTimezone(now, timezone);
  return {
    onDate: ymd,
    timezone: calendar.timezone,
    start,
    endExclusive,
    factoryTodayYmd,
    isToday: ymd === factoryTodayYmd,
    isFuture: ymd > factoryTodayYmd,
  };
}

/**
 * Interval overlap with [dayStart, dayEndExclusive).
 * Open-ended planned end uses plannedStart as a point-in-day.
 */
export function intervalOverlapsFactoryDay(
  plannedStart: Date | string | null | undefined,
  plannedEnd: Date | string | null | undefined,
  dayStart: Date,
  dayEndExclusive: Date,
): boolean {
  const startMs = plannedStart ? new Date(plannedStart).getTime() : NaN;
  const endMs = plannedEnd ? new Date(plannedEnd).getTime() : NaN;
  const hasStart = Number.isFinite(startMs);
  const hasEnd = Number.isFinite(endMs);
  if (!hasStart && !hasEnd) return false;
  const lo = hasStart ? startMs : endMs;
  const hi = hasEnd ? endMs : startMs;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
  const rangeStart = Math.min(lo, hi);
  const rangeEnd = Math.max(lo, hi);
  if (rangeEnd === rangeStart) {
    return rangeStart >= dayStart.getTime() && rangeStart < dayEndExclusive.getTime();
  }
  return rangeStart < dayEndExclusive.getTime() && rangeEnd >= dayStart.getTime();
}

/** Prisma: executable tasks whose planned window overlaps the factory day. */
export function plannedTasksOverlapDayWhere(
  dayStart: Date,
  dayEndExclusive: Date,
): Prisma.ProductionTaskWhereInput {
  return {
    status: { not: 'CANCELLED' },
    isRework: false,
    stageDefinition: {
      executionKind: { not: 'LOGISTICS' },
      code: { not: 'DELIVERY' },
    },
    OR: [
      {
        AND: [
          { plannedStart: { not: null, lt: dayEndExclusive } },
          { plannedCompletion: { not: null, gte: dayStart } },
        ],
      },
      {
        AND: [
          { plannedStart: { gte: dayStart, lt: dayEndExclusive } },
          { plannedCompletion: null },
        ],
      },
      {
        AND: [
          { plannedStart: null },
          { plannedCompletion: { gte: dayStart, lt: dayEndExclusive } },
        ],
      },
    ],
  };
}

/**
 * PO filter for Planned mode: has at least one planned task overlapping the day.
 * Does NOT use createdAt.
 */
export function productionDayLensPlannedWhere(
  bounds: FactoryDayBounds,
): Prisma.ProductionOrderWhereInput {
  return {
    tasks: {
      some: plannedTasksOverlapDayWhere(bounds.start, bounds.endExclusive),
    },
  };
}

/**
 * PO filter for Actual mode: real events that day.
 * Sources with proven timestamps only.
 */
export function productionDayLensActualWhere(
  bounds: FactoryDayBounds,
): Prisma.ProductionOrderWhereInput {
  const { start, endExclusive } = bounds;
  return {
    OR: [
      {
        tasks: {
          some: {
            status: { not: 'CANCELLED' },
            OR: [
              { actualStart: { gte: start, lt: endExclusive } },
              { actualCompletion: { gte: start, lt: endExclusive } },
            ],
          },
        },
      },
      {
        materialUsages: {
          some: {
            OR: [
              { finalizedAt: { gte: start, lt: endExclusive } },
              {
                AND: [
                  { finalizedAt: null },
                  { createdAt: { gte: start, lt: endExclusive } },
                  {
                    OR: [
                      { actualQty: { not: null } },
                      { returnedQty: { gt: 0 } },
                      { scrapQty: { gt: 0 } },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        wipKits: {
          some: {
            createdAt: { gte: start, lt: endExclusive },
          },
        },
      },
      {
        wipHandoffs: {
          some: {
            receivedAt: { gte: start, lt: endExclusive },
          },
        },
      },
      {
        inventoryLots: {
          some: {
            producedAt: { gte: start, lt: endExclusive },
          },
        },
      },
      {
        inspections: {
          some: {
            inspectedAt: { gte: start, lt: endExclusive },
          },
        },
      },
      {
        reworkRequests: {
          some: {
            OR: [
              { createdAt: { gte: start, lt: endExclusive } },
              { completedAt: { gte: start, lt: endExclusive } },
            ],
          },
        },
      },
    ],
  };
}

export function productionDayLensWhere(
  bounds: FactoryDayBounds,
  mode: ProductionDateMode,
): Prisma.ProductionOrderWhereInput {
  return mode === 'planned'
    ? productionDayLensPlannedWhere(bounds)
    : productionDayLensActualWhere(bounds);
}

export function assertValidOnDate(onDate: string | undefined): string | null {
  if (!onDate?.trim()) return null;
  if (!parseYmd(onDate.trim())) {
    throw new Error(`Invalid onDate: ${onDate}`);
  }
  return onDate.trim();
}

export { addDaysYmd, parseYmd, ymdInTimezone, DEFAULT_FACTORY_TIMEZONE };
