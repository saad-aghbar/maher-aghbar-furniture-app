import { parseOvertimeEmployeeIds } from '../overtime-assign';
import type { CalendarExceptionInput, FactoryCalendarInput } from './types';
import { WorkingCalendar, type WorkingInterval } from './working-calendar';

export type WorkerDayWindows = {
  ymd: string;
  workerId: string;
  isWorking: boolean;
  closed: boolean;
  overtime: boolean;
  factoryWideOvertime: boolean;
  intervals: WorkingInterval[];
  normalIntervals: WorkingInterval[];
  overtimeAfter: Date | null;
  availableMinutes: number;
  normalAvailableMinutes: number;
};

function minutesOf(intervals: WorkingInterval[]): number {
  return Math.round(
    intervals.reduce((sum, iv) => sum + Math.max(0, iv.end.getTime() - iv.start.getTime()), 0) /
      60_000,
  );
}

function lastEnd(intervals: WorkingInterval[]): Date | null {
  let max: Date | null = null;
  for (const iv of intervals) {
    if (!max || iv.end.getTime() > max.getTime()) max = iv.end;
  }
  return max;
}

/**
 * Factory-wide EXTRA_SHIFT remains factory-wide when overtimeEmployeeIds is
 * empty/omitted. A non-empty list restricts the extended window to those workers.
 */
export function exceptionAppliesToWorker(
  exception: Pick<CalendarExceptionInput, 'type' | 'overtimeEmployeeIds'> | null | undefined,
  workerId: string,
): boolean {
  if (!exception) return false;
  if (exception.type === 'HOLIDAY' || exception.type === 'SHUTDOWN') return true;
  if (exception.type !== 'EXTRA_SHIFT') return true;
  const ids = parseOvertimeEmployeeIds(exception.overtimeEmployeeIds);
  if (ids.length === 0) return true;
  return ids.includes(workerId);
}

export function calendarInputForWorker(
  input: FactoryCalendarInput,
  workerId: string,
): FactoryCalendarInput {
  const exceptions = (input.exceptions ?? []).filter((ex) => exceptionAppliesToWorker(ex, workerId));
  return { ...input, exceptions };
}

export function workerDayWindows(input: {
  calendarInput: FactoryCalendarInput;
  ymd: string;
  workerId: string;
}): WorkerDayWindows {
  const full = new WorkingCalendar(input.calendarInput);
  const workerCal = new WorkingCalendar(calendarInputForWorker(input.calendarInput, input.workerId));
  const normalCal = new WorkingCalendar({
    ...input.calendarInput,
    exceptions: (input.calendarInput.exceptions ?? []).filter((ex) => ex.type !== 'EXTRA_SHIFT'),
  });

  const intervals = workerCal.intervalsForLocalYmd(input.ymd);
  const normalIntervals = normalCal.intervalsForLocalYmd(input.ymd);
  const factoryIntervals = full.intervalsForLocalYmd(input.ymd);
  const availableMinutes = minutesOf(intervals);
  const normalAvailableMinutes = minutesOf(normalIntervals);
  const overtime = availableMinutes > normalAvailableMinutes;
  const factoryWideOvertime =
    minutesOf(factoryIntervals) > normalAvailableMinutes &&
    (input.calendarInput.exceptions ?? []).some((ex) => {
      if (ex.type !== 'EXTRA_SHIFT') return false;
      return parseOvertimeEmployeeIds(ex.overtimeEmployeeIds).length === 0;
    });

  return {
    ymd: input.ymd,
    workerId: input.workerId,
    isWorking: intervals.length > 0,
    closed: intervals.length === 0,
    overtime,
    factoryWideOvertime,
    intervals,
    normalIntervals,
    overtimeAfter: overtime ? lastEnd(normalIntervals) : null,
    availableMinutes,
    normalAvailableMinutes,
  };
}

export function freeWindowsFromBusy(
  available: WorkingInterval[],
  busy: Array<{ start: Date; end: Date }>,
): Array<{ start: Date; end: Date; durationMinutes: number }> {
  const gaps: Array<{ start: Date; end: Date; durationMinutes: number }> = [];
  for (const window of available) {
    const clips = busy
      .map((b) => ({
        start: new Date(Math.max(b.start.getTime(), window.start.getTime())),
        end: new Date(Math.min(b.end.getTime(), window.end.getTime())),
      }))
      .filter((b) => b.end.getTime() > b.start.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    let cursor = window.start.getTime();
    for (const clip of clips) {
      if (clip.start.getTime() > cursor) {
        gaps.push({
          start: new Date(cursor),
          end: clip.start,
          durationMinutes: Math.round((clip.start.getTime() - cursor) / 60_000),
        });
      }
      cursor = Math.max(cursor, clip.end.getTime());
    }
    if (cursor < window.end.getTime()) {
      gaps.push({
        start: new Date(cursor),
        end: window.end,
        durationMinutes: Math.round((window.end.getTime() - cursor) / 60_000),
      });
    }
  }
  return gaps.filter((g) => g.durationMinutes > 0);
}
