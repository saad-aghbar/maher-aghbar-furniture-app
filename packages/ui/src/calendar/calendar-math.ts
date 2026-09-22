/**
 * Pure calendar helpers — ported from apps/mobile/src/components/calendar/calendarMath.ts
 * so the web MonthCalendar shares the same day model, range rules and load bands.
 * Dates are plain `YYYY-MM-DD` strings in local time; no date library.
 */

export type CalendarCursor = { y: number; m: number };

export type DayTone = 'closed' | 'empty' | 'available' | 'light' | 'half' | 'busy' | 'unavailable' | 'earliest';

export type DayMarker = 'confirmed' | 'proposed' | 'attention';

export type DayMeta = {
  tone?: DayTone;
  /** Density hint for load dots (0–3). */
  density?: number;
  disabled?: boolean;
  /** Highlight as earliest available (dealer). */
  isEarliest?: boolean;
  /** Dealer delivery markers — not colour-only. */
  markers?: DayMarker[];
  count?: number;
  loadPercent?: number | null;
  overtime?: boolean;
  conflict?: boolean;
};

export function todayYmd(now: Date = new Date()): string {
  return toYmd(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYmd(value: string | null | undefined): (CalendarCursor & { d: number }) | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo - 1, d };
}

/** `YYYY-MM-DD` → local Date at midnight (null when invalid). */
export function ymdToDate(value: string | null | undefined): Date | null {
  const p = parseYmd(value);
  return p ? new Date(p.y, p.m, p.d) : null;
}

/** Local Date → `YYYY-MM-DD`. */
export function dateToYmd(date: Date): string {
  return toYmd(date.getFullYear(), date.getMonth(), date.getDate());
}

/** ISO timestamp or `YYYY-MM-DD` → `YYYY-MM-DD` in local time. */
export function anyToYmd(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : dateToYmd(value);
  if (parseYmd(value)) return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : dateToYmd(d);
}

export function monthLabel(year: number, monthIndex: number, locale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex, 1));
  } catch {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }
}

/** Localized short weekday labels, Monday first. */
export function weekdayLabels(locale = 'en', width: 'short' | 'narrow' = 'short'): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: width });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
}

/** Monday-first month cells (null = padding). Always a multiple of 7. */
export function buildMonthCells(year: number, monthIndex: number): Array<number | null> {
  const first = new Date(year, monthIndex, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function shiftMonth(cursor: CalendarCursor, delta: number): CalendarCursor {
  const next = new Date(cursor.y, cursor.m + delta, 1);
  return { y: next.getFullYear(), m: next.getMonth() };
}

export function monthRangeYmd(cursor: CalendarCursor): { from: string; to: string } {
  const from = toYmd(cursor.y, cursor.m, 1);
  const last = new Date(cursor.y, cursor.m + 1, 0).getDate();
  return { from, to: toYmd(cursor.y, cursor.m, last) };
}

export function compareYmd(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function ymdInRange(ymd: string, start: string | null, end: string | null): boolean {
  if (start && compareYmd(ymd, start) < 0) return false;
  if (end && compareYmd(ymd, end) > 0) return false;
  return true;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + days);
  return dateToYmd(d);
}

/**
 * Tap-to-build a date range: first tap is start, second is end (swapped if
 * needed). A third tap starts a new range.
 */
export function nextDateRange(start: string, end: string, tapped: string): { start: string; end: string } {
  if (!start || (start && end)) return { start: tapped, end: '' };
  if (compareYmd(tapped, start) < 0) return { start: tapped, end: start };
  return { start, end: tapped };
}

export function cursorFromYmd(value: string | null | undefined, fallback: string = todayYmd()): CalendarCursor {
  const parsed = parseYmd(value) ?? parseYmd(fallback) ?? parseYmd(todayYmd())!;
  return { y: parsed.y, m: parsed.m };
}

/**
 * Admin month-board tone from factory load % (same bands as Factory Capacity):
 * closed → empty(0%) → light(1–49%) → half(50–84%) → busy(85–100%)
 */
export function adminFactoryLoadTone(loadPercent: number | null | undefined, isWorking: boolean): DayTone {
  if (!isWorking) return 'closed';
  const pct = loadPercent ?? 0;
  if (pct <= 0) return 'empty';
  if (pct < 50) return 'light';
  if (pct < 85) return 'half';
  return 'busy';
}

export function adminFactoryLoadDensity(loadPercent: number | null | undefined, isWorking: boolean): number {
  if (!isWorking) return 0;
  const pct = loadPercent ?? 0;
  if (pct <= 0) return 0;
  if (pct < 50) return 1;
  if (pct < 85) return 2;
  return 3;
}

/** Range presets shared by list filters, statements and reports. */
export type RangePreset = 'today' | 'week' | 'month' | 'last7' | 'last30' | 'last90' | 'ytd';

export function presetRange(preset: RangePreset, now: Date = new Date()): { from: string; to: string } {
  const today = dateToYmd(now);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const day = (now.getDay() + 6) % 7; // Monday = 0
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: dateToYmd(start), to: dateToYmd(end) };
    }
    case 'month': {
      const c = { y: now.getFullYear(), m: now.getMonth() };
      return monthRangeYmd(c);
    }
    case 'last7':
      return { from: addDaysYmd(today, -6), to: today };
    case 'last30':
      return { from: addDaysYmd(today, -29), to: today };
    case 'last90':
      return { from: addDaysYmd(today, -89), to: today };
    case 'ytd':
      return { from: toYmd(now.getFullYear(), 0, 1), to: today };
    default:
      return { from: today, to: today };
  }
}
