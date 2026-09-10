/** Spill / overtime maths for assign-sheet short slots. */

export type SlotChoice = {
  kind: 'fits' | 'spill' | 'overtime';
  startMs: number;
  endMs: number;
  todayMinutes: number;
  nextDayMinutes: number;
  overtimeMinutes: number;
};

export type WorkingDayWindow = {
  ymd: string;
  startMs: number;
  endMs: number;
};

export function parseHm(value?: string | null): { hour: number; minute: number } | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

export function addDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysBetweenYmd(from: string, to: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from.trim());
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to.trim());
  if (!a || !b) return 0;
  const start = new Date(Number(a[1]), Number(a[2]) - 1, Number(a[3])).getTime();
  const end = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3])).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function minutesBetweenMs(startMs: number, endMs: number): number {
  return Math.max(0, Math.round((endMs - startMs) / 60_000));
}

export function overtimeStartMs(opts: {
  shiftEndMs: number;
  lastBusyEndMs: number | null;
}): number {
  return Math.max(opts.shiftEndMs, opts.lastBusyEndMs ?? opts.shiftEndMs);
}

export function nextWorkingYmd(
  fromYmd: string,
  isWorking: (ymd: string) => boolean,
  direction: 1 | -1,
  limit = 21,
): string | null {
  let cursor = fromYmd;
  for (let i = 0; i < limit; i += 1) {
    cursor = addDaysYmd(cursor, direction);
    if (isWorking(cursor)) return cursor;
  }
  return null;
}

export function planShortSlot(opts: {
  slotStartMs: number;
  slotEndMs: number;
  durationMinutes: number;
  shiftEndMs: number;
  workingDays: WorkingDayWindow[];
}): { spill: SlotChoice | null; overtime: SlotChoice } {
  const duration = Math.max(1, Math.round(opts.durationMinutes));
  const todayMinutes = minutesBetweenMs(opts.slotStartMs, opts.slotEndMs);
  const remaining = Math.max(0, duration - todayMinutes);

  const overtime: SlotChoice = {
    kind: 'overtime',
    startMs: opts.slotStartMs,
    endMs: opts.slotStartMs + duration * 60_000,
    todayMinutes: duration,
    nextDayMinutes: 0,
    overtimeMinutes: Math.max(0, minutesBetweenMs(opts.shiftEndMs, opts.slotStartMs + duration * 60_000)),
  };

  if (remaining <= 0) {
    return {
      spill: {
        kind: 'fits',
        startMs: opts.slotStartMs,
        endMs: opts.slotStartMs + duration * 60_000,
        todayMinutes: duration,
        nextDayMinutes: 0,
        overtimeMinutes: 0,
      },
      overtime,
    };
  }

  let leftover = remaining;
  let endMs = opts.slotEndMs;
  let nextDayMinutes = 0;
  const laterDays = opts.workingDays
    .filter((d) => d.startMs >= opts.slotEndMs)
    .sort((a, b) => a.startMs - b.startMs);

  for (const day of laterDays) {
    const available = minutesBetweenMs(day.startMs, day.endMs);
    if (available <= 0) continue;
    const take = Math.min(leftover, available);
    leftover -= take;
    nextDayMinutes += take;
    endMs = day.startMs + take * 60_000;
    if (leftover <= 0) break;
  }

  if (leftover > 0) {
    return { spill: null, overtime };
  }

  return {
    spill: {
      kind: 'spill',
      startMs: opts.slotStartMs,
      endMs,
      todayMinutes,
      nextDayMinutes,
      overtimeMinutes: 0,
    },
    overtime,
  };
}

export type CalendarShift = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export function calendarShiftForYmd(
  ymd: string,
  calendar?: {
    shiftStart?: string;
    shiftEnd?: string;
    exceptions?: Array<{
      date?: string;
      type?: string;
      shiftStart?: string | null;
      shiftEnd?: string | null;
    }>;
  } | null,
): CalendarShift {
  const fallback: CalendarShift = { startHour: 8, startMinute: 0, endHour: 16, endMinute: 0 };
  const start = parseHm(calendar?.shiftStart) ?? { hour: fallback.startHour, minute: fallback.startMinute };
  const end = parseHm(calendar?.shiftEnd) ?? { hour: fallback.endHour, minute: fallback.endMinute };
  const extra = (calendar?.exceptions ?? []).find((ex) => {
    const date = String(ex.date ?? '').slice(0, 10);
    return date === ymd && String(ex.type ?? '') === 'EXTRA_SHIFT';
  });
  const extraStart = parseHm(extra?.shiftStart);
  const extraEnd = parseHm(extra?.shiftEnd);
  return {
    startHour: extraStart?.hour ?? start.hour,
    startMinute: extraStart?.minute ?? start.minute,
    endHour: extraEnd?.hour ?? end.hour,
    endMinute: extraEnd?.minute ?? end.minute,
  };
}

export function workingWindowsFromCalendar(
  days: Array<{ date: string; isWorking: boolean }>,
  calendar: {
    shiftStart?: string;
    shiftEnd?: string;
    exceptions?: Array<{
      date?: string;
      type?: string;
      shiftStart?: string | null;
      shiftEnd?: string | null;
    }>;
  } | null,
  localBounds: (
    ymd: string,
    startHour?: number,
    endHour?: number,
    startMinute?: number,
    endMinute?: number,
  ) => { dayStartMs: number; dayEndMs: number } | null,
): WorkingDayWindow[] {
  return days
    .filter((d) => d.isWorking)
    .map((d) => {
      const ymd = d.date.slice(0, 10);
      const shift = calendarShiftForYmd(ymd, calendar);
      const bounds = localBounds(
        ymd,
        shift.startHour,
        shift.endHour,
        shift.startMinute,
        shift.endMinute,
      );
      if (!bounds) return null;
      return { ymd, startMs: bounds.dayStartMs, endMs: bounds.dayEndMs };
    })
    .filter((d): d is WorkingDayWindow => Boolean(d));
}
