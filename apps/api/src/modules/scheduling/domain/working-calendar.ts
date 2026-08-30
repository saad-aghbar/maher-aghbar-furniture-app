import type {
  CalendarExceptionInput,
  FactoryCalendarInput,
  TimeOfDayRange,
} from './types';

export interface WorkingInterval {
  start: Date;
  end: Date;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0=Sunday .. 6=Saturday */
  weekday: number;
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseHm(hm: string): { hour: number; minute: number } {
  const [hRaw, mRaw] = hm.split(':');
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Invalid HH:mm value: ${hm}`);
  }
  return { hour, minute };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function addDaysYmd(ymd: string, days: number): string {
  const parsed = parseYmd(ymd);
  if (!parsed) {
    throw new Error(`Invalid YYYY-MM-DD value: ${ymd}`);
  }
  const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return localDateKey(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

export function eachYmdInclusive(fromYmd: string, toYmd: string): string[] {
  if (fromYmd > toYmd) return [];
  const out: string[] = [];
  let cursor = fromYmd;
  for (let guard = 0; guard < 400 && cursor <= toYmd; guard += 1) {
    out.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return out;
}

/** Minutes where `[start, end)` overlaps any working interval. Lunch and nights are excluded. */
export function overlapWorkingMinutes(
  start: Date,
  end: Date,
  intervals: readonly WorkingInterval[],
): number {
  const s = start.getTime();
  const e = end.getTime();
  if (!(e > s)) return 0;
  let minutes = 0;
  for (const interval of intervals) {
    const a = Math.max(s, interval.start.getTime());
    const b = Math.min(e, interval.end.getTime());
    if (b > a) minutes += (b - a) / 60_000;
  }
  return minutes;
}

function getLocalParts(date: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const weekdayName = get('weekday');
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAY_MAP[weekdayName] ?? 0,
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * Handles DST by measuring the offset of an initial UTC guess.
 */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const asLocal = getLocalParts(utcGuess, timeZone);
  const asLocalMs = Date.UTC(
    asLocal.year,
    asLocal.month - 1,
    asLocal.day,
    asLocal.hour,
    asLocal.minute,
    asLocal.second,
  );
  const desiredMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const adjusted = new Date(utcGuess.getTime() + (desiredMs - asLocalMs));

  // Second pass for DST transition edge cases
  const check = getLocalParts(adjusted, timeZone);
  const checkMs = Date.UTC(
    check.year,
    check.month - 1,
    check.day,
    check.hour,
    check.minute,
    check.second,
  );
  if (checkMs !== desiredMs) {
    return new Date(adjusted.getTime() + (desiredMs - checkMs));
  }
  return adjusted;
}

function exceptionDateKey(exception: CalendarExceptionInput, timeZone: string): string {
  const p = getLocalParts(exception.date, timeZone);
  return localDateKey(p.year, p.month, p.day);
}

function subtractBreaks(
  dayStart: Date,
  dayEnd: Date,
  breaks: TimeOfDayRange[],
  year: number,
  month: number,
  day: number,
  timeZone: string,
): WorkingInterval[] {
  if (dayEnd.getTime() <= dayStart.getTime()) return [];

  const breakIntervals = breaks
    .map((b) => {
      const s = parseHm(b.start);
      const e = parseHm(b.end);
      return {
        start: zonedLocalToUtc(year, month, day, s.hour, s.minute, 0, timeZone),
        end: zonedLocalToUtc(year, month, day, e.hour, e.minute, 0, timeZone),
      };
    })
    .filter((b) => b.end.getTime() > b.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const result: WorkingInterval[] = [];
  let cursor = dayStart.getTime();
  const endMs = dayEnd.getTime();

  for (const br of breakIntervals) {
    const brStart = Math.max(cursor, br.start.getTime());
    const brEnd = Math.min(endMs, br.end.getTime());
    if (brStart >= endMs) break;
    if (brStart > cursor) {
      result.push({ start: new Date(cursor), end: new Date(brStart) });
    }
    if (brEnd > cursor) cursor = brEnd;
  }

  if (cursor < endMs) {
    result.push({ start: new Date(cursor), end: new Date(endMs) });
  }

  return result;
}

export class WorkingCalendar {
  readonly timezone: string;
  readonly workingWeekdays: Set<number>;
  readonly shiftStart: string;
  readonly shiftEnd: string;
  readonly breaks: TimeOfDayRange[];
  private readonly exceptionsByDate: Map<string, CalendarExceptionInput>;

  constructor(input: FactoryCalendarInput) {
    this.timezone = input.timezone;
    this.workingWeekdays = new Set(input.workingWeekdays);
    this.shiftStart = input.shiftStart;
    this.shiftEnd = input.shiftEnd;
    this.breaks = [...(input.breaks ?? [])];
    this.exceptionsByDate = new Map();
    for (const ex of input.exceptions ?? []) {
      this.exceptionsByDate.set(exceptionDateKey(ex, this.timezone), ex);
    }
  }

  localInstant(ymd: string, hour = 12, minute = 0, second = 0): Date {
    const parsed = parseYmd(ymd);
    if (!parsed) {
      throw new Error(`Invalid YYYY-MM-DD value: ${ymd}`);
    }
    return zonedLocalToUtc(
      parsed.year,
      parsed.month,
      parsed.day,
      hour,
      minute,
      second,
      this.timezone,
    );
  }

  intervalsForLocalYmd(ymd: string): WorkingInterval[] {
    return this.intervalsForLocalDay(this.localInstant(ymd, 12, 0));
  }

  /** Factory-local `[fromYmd 00:00, toYmd+1 00:00)` in UTC instants. */
  localRangeBounds(fromYmd: string, toYmd: string): { start: Date; endExclusive: Date } {
    return {
      start: this.localInstant(fromYmd, 0, 0),
      endExclusive: this.localInstant(addDaysYmd(toYmd, 1), 0, 0),
    };
  }

  expandWorkingIntervalsForYmdRange(fromYmd: string, toYmd: string): WorkingInterval[] {
    return eachYmdInclusive(fromYmd, toYmd).flatMap((ymd) => this.intervalsForLocalYmd(ymd));
  }

  overlapWorkingMinutesOnLocalDay(start: Date, end: Date, ymd: string): number {
    return overlapWorkingMinutes(start, end, this.intervalsForLocalYmd(ymd));
  }

  localYmd(date: Date): string {
    const p = getLocalParts(date, this.timezone);
    return localDateKey(p.year, p.month, p.day);
  }

  /**
   * Factory-local YMDs where `[start, end)` overlaps working intervals.
   * Empty working days inside a wall-clock span are omitted.
   */
  occupiedLocalYmds(start: Date, end: Date, fromYmd?: string, toYmd?: string): string[] {
    if (!(end.getTime() > start.getTime())) return [];
    const startKey = this.localYmd(start);
    const endKey = this.localYmd(new Date(end.getTime() - 1));
    const lo = fromYmd && fromYmd > startKey ? fromYmd : startKey;
    const hi = toYmd && toYmd < endKey ? toYmd : endKey;
    if (lo > hi) return [];
    return eachYmdInclusive(lo, hi).filter(
      (ymd) => this.overlapWorkingMinutesOnLocalDay(start, end, ymd) > 0,
    );
  }

  /** Working intervals for the local calendar day of `day`. */
  intervalsForLocalDay(day: Date): WorkingInterval[] {
    const p = getLocalParts(day, this.timezone);
    const key = localDateKey(p.year, p.month, p.day);
    const ex = this.exceptionsByDate.get(key);

    if (ex?.type === 'HOLIDAY' || ex?.type === 'SHUTDOWN') {
      return [];
    }

    let shiftStart = this.shiftStart;
    let shiftEnd = this.shiftEnd;
    let applyBreaks = true;

    if (ex?.type === 'EXTRA_SHIFT') {
      // Open a closed day or extend hours (overtime). Always keep lunch breaks so
      // evening overtime adds capacity after the normal window rather than dropping midday.
      shiftStart = ex.shiftStart ?? this.shiftStart;
      shiftEnd = ex.shiftEnd ?? this.shiftEnd;
      applyBreaks = true;
    } else if (!this.workingWeekdays.has(p.weekday)) {
      return [];
    }

    const startHm = parseHm(shiftStart);
    const endHm = parseHm(shiftEnd);
    const dayStart = zonedLocalToUtc(
      p.year,
      p.month,
      p.day,
      startHm.hour,
      startHm.minute,
      0,
      this.timezone,
    );
    const dayEnd = zonedLocalToUtc(
      p.year,
      p.month,
      p.day,
      endHm.hour,
      endHm.minute,
      0,
      this.timezone,
    );

    if (applyBreaks && this.breaks.length > 0) {
      return subtractBreaks(
        dayStart,
        dayEnd,
        this.breaks,
        p.year,
        p.month,
        p.day,
        this.timezone,
      );
    }

    if (dayEnd.getTime() <= dayStart.getTime()) return [];
    return [{ start: dayStart, end: dayEnd }];
  }

  /** Expand working intervals from `from` (inclusive search) covering `dayCount` local days. */
  expandWorkingIntervals(from: Date, dayCount: number): WorkingInterval[] {
    const startParts = getLocalParts(from, this.timezone);
    const intervals: WorkingInterval[] = [];
    for (let i = 0; i < dayCount; i++) {
      const noonUtc = zonedLocalToUtc(
        startParts.year,
        startParts.month,
        startParts.day,
        12,
        0,
        0,
        this.timezone,
      );
      const dayInstant = new Date(noonUtc.getTime() + i * 24 * 60 * 60 * 1000);
      intervals.push(...this.intervalsForLocalDay(dayInstant));
    }
    return intervals;
  }

  isWorking(instant: Date): boolean {
    const intervals = this.intervalsForLocalDay(instant);
    const t = instant.getTime();
    return intervals.some((iv) => t >= iv.start.getTime() && t < iv.end.getTime());
  }

  /** Next instant that is inside a working interval (>= instant if already working). */
  nextWorkingInstant(instant: Date): Date {
    if (this.isWorking(instant)) return new Date(instant.getTime());

    const startParts = getLocalParts(instant, this.timezone);
    for (let i = 0; i < 3660; i++) {
      const noonUtc = zonedLocalToUtc(
        startParts.year,
        startParts.month,
        startParts.day,
        12,
        0,
        0,
        this.timezone,
      );
      const dayInstant = new Date(noonUtc.getTime() + i * 24 * 60 * 60 * 1000);
      const intervals = this.intervalsForLocalDay(dayInstant);
      for (const iv of intervals) {
        if (iv.end.getTime() <= instant.getTime()) continue;
        if (instant.getTime() < iv.start.getTime()) return new Date(iv.start.getTime());
        if (instant.getTime() < iv.end.getTime()) return new Date(instant.getTime());
      }
    }

    throw new Error('No working instant found within search horizon');
  }

  /** Previous working instant (<= instant if working just before end of an interval). */
  previousWorkingInstant(instant: Date): Date {
    // If standing at an exclusive end, step 1ms into the prior working second.
    const probe = new Date(instant.getTime() - 1);
    if (this.isWorking(probe)) return new Date(instant.getTime());

    const startParts = getLocalParts(instant, this.timezone);
    for (let i = 0; i < 3660; i++) {
      const noonUtc = zonedLocalToUtc(
        startParts.year,
        startParts.month,
        startParts.day,
        12,
        0,
        0,
        this.timezone,
      );
      const dayInstant = new Date(noonUtc.getTime() - i * 24 * 60 * 60 * 1000);
      const intervals = this.intervalsForLocalDay(dayInstant);
      for (let j = intervals.length - 1; j >= 0; j--) {
        const iv = intervals[j]!;
        if (iv.start.getTime() >= instant.getTime()) continue;
        if (instant.getTime() > iv.end.getTime()) return new Date(iv.end.getTime());
        if (instant.getTime() > iv.start.getTime()) return new Date(instant.getTime());
      }
    }

    throw new Error('No previous working instant found within search horizon');
  }

  addWorkingMinutes(start: Date, minutes: number): Date {
    if (minutes <= 0) return this.nextWorkingInstant(start);

    let remainingMs = minutes * 60_000;
    let cursor = this.nextWorkingInstant(start);

    for (let guard = 0; guard < 50_000 && remainingMs > 0; guard++) {
      const intervals = this.intervalsForLocalDay(cursor);
      let progressed = false;
      for (const iv of intervals) {
        if (iv.end.getTime() <= cursor.getTime()) continue;
        const segStart = Math.max(cursor.getTime(), iv.start.getTime());
        if (segStart >= iv.end.getTime()) continue;
        const available = iv.end.getTime() - segStart;
        if (available >= remainingMs) {
          return new Date(segStart + remainingMs);
        }
        remainingMs -= available;
        cursor = new Date(iv.end.getTime());
        progressed = true;
      }
      if (!progressed) {
        // Jump to next day's first working instant
        const parts = getLocalParts(cursor, this.timezone);
        const nextNoon = new Date(
          zonedLocalToUtc(parts.year, parts.month, parts.day, 12, 0, 0, this.timezone).getTime() +
            24 * 60 * 60 * 1000,
        );
        cursor = this.nextWorkingInstant(nextNoon);
      } else if (remainingMs > 0) {
        cursor = this.nextWorkingInstant(cursor);
      }
    }

    throw new Error('Unable to add working minutes within search horizon');
  }

  subtractWorkingMinutes(end: Date, minutes: number): Date {
    if (minutes <= 0) return this.previousWorkingInstant(end);

    let remainingMs = minutes * 60_000;
    let cursor = this.previousWorkingInstant(end);

    for (let guard = 0; guard < 50_000 && remainingMs > 0; guard++) {
      const intervals = this.intervalsForLocalDay(new Date(cursor.getTime() - 1));
      let progressed = false;
      for (let j = intervals.length - 1; j >= 0; j--) {
        const iv = intervals[j]!;
        if (iv.start.getTime() >= cursor.getTime()) continue;
        const segEnd = Math.min(cursor.getTime(), iv.end.getTime());
        if (segEnd <= iv.start.getTime()) continue;
        const available = segEnd - iv.start.getTime();
        if (available >= remainingMs) {
          return new Date(segEnd - remainingMs);
        }
        remainingMs -= available;
        cursor = new Date(iv.start.getTime());
        progressed = true;
      }
      if (!progressed) {
        const parts = getLocalParts(new Date(cursor.getTime() - 1), this.timezone);
        const prevNoon = new Date(
          zonedLocalToUtc(parts.year, parts.month, parts.day, 12, 0, 0, this.timezone).getTime() -
            24 * 60 * 60 * 1000,
        );
        cursor = this.previousWorkingInstant(prevNoon);
      } else if (remainingMs > 0) {
        cursor = this.previousWorkingInstant(cursor);
      }
    }

    throw new Error('Unable to subtract working minutes within search horizon');
  }

  /** Shift-end of the local working day containing `instant` (or previous working day if closed). */
  endOfWorkingDay(instant: Date): Date {
    const intervals = this.intervalsForLocalDay(instant);
    if (intervals.length > 0) {
      return new Date(intervals[intervals.length - 1]!.end.getTime());
    }
    const prev = this.previousWorkingInstant(instant);
    const prevIntervals = this.intervalsForLocalDay(new Date(prev.getTime() - 1));
    if (prevIntervals.length > 0) {
      return new Date(prevIntervals[prevIntervals.length - 1]!.end.getTime());
    }
    return prev;
  }

  /**
   * Latest allowed production completion for a requested delivery date.
   * `bufferWorkingDays=1` → end of shift on the previous working day (delivery day reserved).
   * `bufferWorkingDays=0` → end of shift on the delivery day if it is working.
   */
  latestProductionCompletion(requested: Date, bufferWorkingDays: number): Date {
    const parts = getLocalParts(requested, this.timezone);
    const deliveryMidnight = zonedLocalToUtc(parts.year, parts.month, parts.day, 0, 0, 0, this.timezone);
    const days = Math.max(0, Math.floor(bufferWorkingDays));
    if (days === 0) {
      return this.endOfWorkingDay(
        this.intervalsForLocalDay(deliveryMidnight).length > 0
          ? deliveryMidnight
          : this.previousWorkingInstant(deliveryMidnight),
      );
    }
    let end = this.endOfWorkingDay(this.previousWorkingInstant(deliveryMidnight));
    for (let i = 1; i < days; i++) {
      end = this.endOfWorkingDay(this.previousWorkingInstant(new Date(end.getTime() - 1)));
    }
    return end;
  }
}
