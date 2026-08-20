/** Frozen presentation clock. Re-runs must not drift. */

export const DEMO_TZ = 'Asia/Amman';
export const DEMO_AS_OF_YMD = '2026-08-16';
export const DEMO_WINDOW_START_YMD = '2026-06-16';
/** Jordan observes UTC+3 year-round. */
export const DEMO_UTC_OFFSET_HOURS = 3;

export function demoAsOf(): Date {
  const override = process.env.DEMO_AS_OF?.trim();
  if (override) {
    const parsed = Date.parse(override.includes('T') ? override : `${override}T14:00:00+03:00`);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid DEMO_AS_OF: ${override}`);
    }
    return new Date(parsed);
  }
  return ammanLocal(2026, 8, 16, 14, 0);
}

export function demoWindowStart(): Date {
  return ammanLocal(2026, 6, 16, 8, 0);
}

export function demoYear(): number {
  return demoAsOf().getUTCFullYear();
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

export function ymd(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}
