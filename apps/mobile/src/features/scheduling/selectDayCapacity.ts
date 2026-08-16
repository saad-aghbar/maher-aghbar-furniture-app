const STEP_MINUTES = 30;
const DEFAULT_EXTRA_MINUTES = 4 * 60;
const DAY_MAX_MINUTES = 23 * 60 + 30;

export function parseHmToMinutes(hm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutesToHm(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function overtimeBounds(shiftEndHm: string): { min: number; max: number } {
  const end = parseHmToMinutes(shiftEndHm) ?? 16 * 60;
  return { min: Math.min(DAY_MAX_MINUTES, end + STEP_MINUTES), max: DAY_MAX_MINUTES };
}

function snapToStep(total: number): number {
  return Math.round(total / STEP_MINUTES) * STEP_MINUTES;
}

export function defaultOvertimeEnd(shiftEndHm: string): string {
  const end = parseHmToMinutes(shiftEndHm) ?? 16 * 60;
  const { min, max } = overtimeBounds(shiftEndHm);
  return formatMinutesToHm(Math.min(max, Math.max(min, snapToStep(end + DEFAULT_EXTRA_MINUTES))));
}

export function stepOvertimeEnd(
  currentHm: string,
  shiftEndHm: string,
  deltaSteps: number,
): string {
  const { min, max } = overtimeBounds(shiftEndHm);
  const current = parseHmToMinutes(currentHm) ?? parseHmToMinutes(defaultOvertimeEnd(shiftEndHm)) ?? min;
  return formatMinutesToHm(Math.min(max, Math.max(min, snapToStep(current + deltaSteps * STEP_MINUTES))));
}

export function canStepOvertime(currentHm: string, shiftEndHm: string, deltaSteps: number): boolean {
  return stepOvertimeEnd(currentHm, shiftEndHm, deltaSteps) !== formatMinutesToHm(
    parseHmToMinutes(currentHm) ?? 0,
  );
}

export function overtimeExtraMinutes(shiftEndHm: string, overtimeEndHm: string): number {
  const start = parseHmToMinutes(shiftEndHm) ?? 16 * 60;
  const end = parseHmToMinutes(overtimeEndHm) ?? start;
  return Math.max(0, end - start);
}

export function overtimeHoursLabel(minutes: number): string {
  const hours = minutes / 60;
  if (!Number.isFinite(hours)) return '0';
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
