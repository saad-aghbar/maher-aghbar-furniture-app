/** Demo presentation clock. Defaults to reset-time so "today / this week" stay useful. */

export const DEMO_TZ = 'Asia/Amman';
/** Jordan observes UTC+3 year-round. */
export const DEMO_UTC_OFFSET_HOURS = 3;

/** @deprecated Prefer demoAsOf() — kept for docs/search that still mention the old freeze. */
export const DEMO_AS_OF_YMD = 'relative';
/** @deprecated Prefer daysAgo / demoWindowStart(). */
export const DEMO_WINDOW_START_YMD = 'relative-21d';

/**
 * As-of instant for the demo world.
 * Override with DEMO_AS_OF=YYYY-MM-DD or an ISO timestamp for deterministic CI.
 * Default: today 14:00 Asia/Amman (wall clock at reset).
 */
export function demoAsOf(): Date {
  const override = process.env.DEMO_AS_OF?.trim();
  if (override) {
    const parsed = Date.parse(override.includes('T') ? override : `${override}T14:00:00+03:00`);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid DEMO_AS_OF: ${override}`);
    }
    return new Date(parsed);
  }
  const now = new Date();
  // Snap to 14:00 Amman on the current Amman calendar day so seeds are stable within a day.
  const ammanParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEMO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(ammanParts.find((p) => p.type === 'year')?.value);
  const month = Number(ammanParts.find((p) => p.type === 'month')?.value);
  const day = Number(ammanParts.find((p) => p.type === 'day')?.value);
  return ammanLocal(year, month, day, 14, 0);
}

/** Start of the curated demo window (~3 weeks before as-of). */
export function demoWindowStart(): Date {
  return daysAgo(21);
}

export function demoYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: DEMO_TZ, year: 'numeric' }).format(demoAsOf()),
  );
}

/** Local civil time in Asia/Amman → UTC Date. */
export function ammanLocal(
  year: number,
  month: number,
  day: number,
  hour = 10,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - DEMO_UTC_OFFSET_HOURS, minute, second));
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Relative to demoAsOf(): today = daysAgo(0), yesterday = daysAgo(1), etc. */
export function daysAgo(days: number, hour = 10, minute = 0): Date {
  const asOf = demoAsOf();
  const shifted = addDays(asOf, -days);
  const ammanParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEMO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted);
  const year = Number(ammanParts.find((p) => p.type === 'year')?.value);
  const month = Number(ammanParts.find((p) => p.type === 'month')?.value);
  const day = Number(ammanParts.find((p) => p.type === 'day')?.value);
  return ammanLocal(year, month, day, hour, minute);
}

export function ymd(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}
