/**
 * Shift-hours + calendar helpers for the assign sheet (port of mobile
 * `assignOvertime.ts` essentials). Pure functions so the sheet stays thin.
 */

export type CalendarShift = { startHour: number; startMinute: number; endHour: number; endMinute: number };

export type CalendarMeta = {
  shiftStart?: string | null;
  shiftEnd?: string | null;
  workingWeekdays?: number[] | null;
  exceptions?: Array<{ date?: string; type?: string; shiftStart?: string | null; shiftEnd?: string | null }>;
};

export function parseHm(value?: string | null): { hour: number; minute: number } | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Shift for a local day; an EXTRA_SHIFT exception overrides the default hours. */
export function calendarShiftForYmd(ymd: string, calendar?: CalendarMeta | null): CalendarShift {
  const fallback: CalendarShift = { startHour: 8, startMinute: 0, endHour: 16, endMinute: 0 };
  const start = parseHm(calendar?.shiftStart) ?? { hour: fallback.startHour, minute: fallback.startMinute };
  const end = parseHm(calendar?.shiftEnd) ?? { hour: fallback.endHour, minute: fallback.endMinute };
  const extra = (calendar?.exceptions ?? []).find((ex) => String(ex.date ?? '').slice(0, 10) === ymd && String(ex.type ?? '') === 'EXTRA_SHIFT');
  const extraStart = parseHm(extra?.shiftStart);
  const extraEnd = parseHm(extra?.shiftEnd);
  return {
    startHour: extraStart?.hour ?? start.hour,
    startMinute: extraStart?.minute ?? start.minute,
    endHour: extraEnd?.hour ?? end.hour,
    endMinute: extraEnd?.minute ?? end.minute,
  };
}

export function todayYmd(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addDaysYmd(ymd: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta);
  return todayYmd(d);
}

/** ISO instant for a local Y-M-D + hh:mm. */
export function localIso(ymd: string, hour: number, minute: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function ymdOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : todayYmd(d);
}

/** Minutes → "2h 30m" / "45 min". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}
