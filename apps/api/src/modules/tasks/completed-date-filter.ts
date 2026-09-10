import { Prisma } from '@maher/database';
import {
  parseYmd,
  resolveFactoryDayBounds,
} from '../production/production-day-lens';

export type CompletedDateWindow = {
  gte?: Date;
  lt?: Date;
};

/** Inclusive factory-local day range → UTC bounds. */
export function completedDateWindow(
  fromYmd: string | undefined,
  toYmd: string | undefined,
  timezone: string,
): CompletedDateWindow | null {
  const from = fromYmd?.trim() && parseYmd(fromYmd.trim()) ? fromYmd.trim() : null;
  const to = toYmd?.trim() && parseYmd(toYmd.trim()) ? toYmd.trim() : null;
  if (!from && !to) return null;
  return {
    gte: from ? resolveFactoryDayBounds(from, timezone).start : undefined,
    lt: to ? resolveFactoryDayBounds(to, timezone).endExclusive : undefined,
  };
}

/**
 * Finished-on filter: actualCompletion in the factory-day window, or
 * null actualCompletion with updatedAt in that window (legacy seed rows).
 */
export function completedOnFactoryDaysWhere(
  window: CompletedDateWindow,
): Prisma.ProductionTaskWhereInput {
  const range: Prisma.DateTimeFilter = {
    ...(window.gte ? { gte: window.gte } : {}),
    ...(window.lt ? { lt: window.lt } : {}),
  };
  return {
    OR: [
      { actualCompletion: range },
      { AND: [{ actualCompletion: null }, { updatedAt: range }] },
    ],
  };
}
