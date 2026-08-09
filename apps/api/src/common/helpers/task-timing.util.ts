export type TaskTimingStatus = 'running' | 'stopped' | 'idle' | 'done';

export type TaskTimingSummary = {
  status: TaskTimingStatus;
  actualMinutes: number;
  /** Closed sessions only, from wall-clock entry times when available. */
  actualSeconds: number;
  openStartedAt: string | null;
  estimatedMinutes: number | null;
  plannedCompletion: string | null;
  /** Closed sessions + open segment minutes (floored). */
  elapsedMinutes: number;
};

type TimingInput = {
  status: string;
  actualMinutes?: number | null;
  /** Prefer wall-clock closed seconds when provided by caller. */
  actualSeconds?: number | null;
  estimatedMinutes?: number | null;
  plannedCompletion?: Date | string | null;
  openStartedAt?: Date | string | null;
  now?: Date;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function openSegmentSeconds(openStartedAt: Date | string | null | undefined, now: Date): number {
  if (openStartedAt == null) return 0;
  const start = openStartedAt instanceof Date ? openStartedAt : new Date(openStartedAt);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
}

/** Sum closed time-entry durations in whole seconds (no rounding up). */
export function closedSecondsFromTimeEntries(
  entries:
    | Array<{ startedAt: Date | string; endedAt?: Date | string | null }>
    | null
    | undefined,
): number {
  if (!entries?.length) return 0;
  let total = 0;
  for (const entry of entries) {
    if (entry.endedAt == null) continue;
    const start =
      entry.startedAt instanceof Date
        ? entry.startedAt.getTime()
        : new Date(entry.startedAt).getTime();
    const end =
      entry.endedAt instanceof Date
        ? entry.endedAt.getTime()
        : new Date(entry.endedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) continue;
    total += Math.floor((end - start) / 1000);
  }
  return total;
}

/**
 * Normalize task work-session timing for API clients (live timer + due/estimate).
 */
export function buildTaskTimingSummary(input: TimingInput): TaskTimingSummary {
  const now = input.now ?? new Date();
  const actualMinutes = Math.max(0, Number(input.actualMinutes ?? 0) || 0);
  const actualSeconds =
    input.actualSeconds != null && Number.isFinite(Number(input.actualSeconds))
      ? Math.max(0, Math.floor(Number(input.actualSeconds)))
      : Math.max(0, Math.floor(actualMinutes)) * 60;
  const estimatedMinutes =
    input.estimatedMinutes == null || !Number.isFinite(Number(input.estimatedMinutes))
      ? null
      : Math.max(0, Math.round(Number(input.estimatedMinutes)));
  const plannedCompletion = toIso(input.plannedCompletion);
  const openStartedAtIso = toIso(input.openStartedAt);
  const statusUpper = String(input.status ?? '').toUpperCase();

  let status: TaskTimingStatus = 'idle';
  if (statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') {
    status = 'done';
  } else if (statusUpper === 'IN_PROGRESS' && openStartedAtIso) {
    status = 'running';
  } else if (
    statusUpper === 'PAUSED' ||
    statusUpper === 'BLOCKED' ||
    statusUpper === 'READY_FOR_INSPECTION' ||
    actualMinutes > 0 ||
    actualSeconds > 0
  ) {
    status = 'stopped';
  }

  const openSeconds = status === 'running' ? openSegmentSeconds(input.openStartedAt, now) : 0;

  return {
    status,
    actualMinutes,
    actualSeconds,
    openStartedAt: status === 'running' ? openStartedAtIso : null,
    estimatedMinutes,
    plannedCompletion,
    elapsedMinutes: Math.floor((actualSeconds + openSeconds) / 60),
  };
}
