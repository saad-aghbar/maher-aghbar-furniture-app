export type TaskTimingStatus = 'running' | 'stopped' | 'idle' | 'done';

export type TaskTimingSummary = {
  status: TaskTimingStatus;
  actualMinutes: number;
  /** Closed sessions in whole seconds (preferred for the clock). */
  actualSeconds?: number;
  openStartedAt: string | null;
  estimatedMinutes: number | null;
  plannedCompletion: string | null;
  elapsedMinutes: number;
};

/** Format whole minutes as `2h 15m` / `45m` / `3h`. */
export function formatMinutesDuration(
  totalMinutes: number,
  labels: { hour: string; minute: string },
): string {
  const whole = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h > 0 && m > 0) return `${h}${labels.hour} ${m}${labels.minute}`;
  if (h > 0) return `${h}${labels.hour}`;
  return `${m}${labels.minute}`;
}

/** Live clock `HH:MM:SS` from total seconds. */
export function formatElapsedClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

export function hoursMinutesToTotalMinutes(hours: number, minutes: number): number {
  return Math.max(0, Math.round(hours) * 60 + Math.round(minutes));
}

export function totalMinutesToHoursMinutes(total: number): { hours: number; minutes: number } {
  const whole = Math.max(0, Math.round(total));
  return { hours: Math.floor(whole / 60), minutes: whole % 60 };
}

/** Whole minutes between two timestamps (clamped ≥ 0). */
export function minutesBetween(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined = new Date(),
): number {
  if (start == null || end == null) return 0;
  const a = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const b = end instanceof Date ? end.getTime() : new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 60000);
}

/** Build ISO datetime from local date (YYYY-MM-DD) + hour + minute. */
export function buildDueIso(dateYmd: string, hour: number, minute: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const h = Math.min(23, Math.max(0, Math.round(hour)));
  const m = Math.min(59, Math.max(0, Math.round(minute)));
  const d = new Date(`${dateYmd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
