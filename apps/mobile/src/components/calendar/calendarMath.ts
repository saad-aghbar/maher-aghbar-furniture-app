/** Pure calendar helpers shared by MonthCalendar and scheduling selectors. */

export type CalendarCursor = { y: number; m: number };

export type DayTone =
  | 'closed'
  | 'empty'
  | 'available'
  | 'light'
  | 'half'
  | 'busy'
  | 'unavailable'
  | 'earliest';

export type DayMeta = {
  tone: DayTone;
  /** Optional density hint for admin load dots (0–3). */
  density?: number;
  disabled?: boolean;
  /** Highlight as earliest available (dealer). */
  isEarliest?: boolean;
};

export function todayYmd(now: Date = new Date()): string {
  return toYmd(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYmd(value: string): CalendarCursor & { d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return { y, m: mo - 1, d };
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(new Date(year, monthIndex, 1));
}

/** Monday-first month cells (null = padding). */
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
  const to = toYmd(cursor.y, cursor.m, last);
  return { from, to };
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

/** English weekday short labels Mon→Sun (display only; layout flips for RTL). */
export const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/**
 * Admin load thresholds (deterministic):
 * closed → empty(0) → light(1–2) → half(3–5) → busy(6+)
 */
export function adminLoadTone(orderCount: number, isWorking: boolean): DayTone {
  if (!isWorking) return 'closed';
  if (orderCount <= 0) return 'empty';
  if (orderCount <= 2) return 'light';
  if (orderCount <= 5) return 'half';
  return 'busy';
}

export function adminLoadDensity(orderCount: number, isWorking: boolean): number {
  if (!isWorking || orderCount <= 0) return 0;
  if (orderCount <= 2) return 1;
  if (orderCount <= 5) return 2;
  return 3;
}
