export function hmToMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

export function laterHm(a: string, b: string): string {
  const am = hmToMinutes(a);
  const bm = hmToMinutes(b);
  if (am == null) return b;
  if (bm == null) return a;
  return bm > am ? b : a;
}

export function parseOvertimeEmployeeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function mergeOvertimeException(opts: {
  existing?: {
    type?: string | null;
    shiftStart?: string | null;
    shiftEnd?: string | null;
    overtimeEmployeeIds?: unknown;
  } | null;
  calendarShiftStart: string;
  calendarShiftEnd: string;
  untilHm: string;
  employeeId: string;
}): { shiftStart: string; shiftEnd: string; overtimeEmployeeIds: string[] } {
  const existingIds = parseOvertimeEmployeeIds(opts.existing?.overtimeEmployeeIds);
  const shiftStart =
    opts.existing?.type === 'EXTRA_SHIFT' && opts.existing.shiftStart
      ? opts.existing.shiftStart
      : opts.calendarShiftStart;
  const currentEnd =
    opts.existing?.type === 'EXTRA_SHIFT' && opts.existing.shiftEnd
      ? opts.existing.shiftEnd
      : opts.calendarShiftEnd;
  return {
    shiftStart,
    shiftEnd: laterHm(currentEnd, opts.untilHm),
    overtimeEmployeeIds: existingIds.includes(opts.employeeId)
      ? existingIds
      : [...existingIds, opts.employeeId],
  };
}

export function hmInTimezone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hour}:${minute}`;
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
