/**
 * Timer-based floor percent: worked minutes / assigned minutes.
 * Caps at 100 while waiting for Finish — never 99, never auto-completes.
 */

import {
  buildTaskTimingSummary,
  closedSecondsFromTimeEntries,
  type TaskTimingSummary,
} from './task-timing.util';

export type LiveProgressInput = {
  status?: string | null;
  elapsedMinutes: number;
  estimatedMinutes?: number | null;
  /** Checklist-driven stages (inspection / delivery load). */
  checkedCount?: number | null;
  totalCount?: number | null;
};

function statusUpper(status?: string | null): string {
  return String(status ?? '').toUpperCase();
}

export function liveElapsedMinutes(input: {
  running: boolean;
  openStartedAt?: string | Date | null;
  closedSeconds: number;
  now?: Date | number;
}): number {
  const closed = Math.max(0, Math.floor(Number(input.closedSeconds) || 0));
  let open = 0;
  if (input.running && input.openStartedAt) {
    const start =
      input.openStartedAt instanceof Date
        ? input.openStartedAt.getTime()
        : new Date(input.openStartedAt).getTime();
    const now =
      input.now instanceof Date
        ? input.now.getTime()
        : typeof input.now === 'number'
          ? input.now
          : Date.now();
    if (!Number.isNaN(start)) open = Math.max(0, Math.floor((now - start) / 1000));
  }
  return Math.floor((closed + open) / 60);
}

export function liveTaskProgressPercent(input: LiveProgressInput): number {
  const status = statusUpper(input.status);
  if (status === 'COMPLETED' || status === 'DONE') return 100;
  if (status === 'CANCELLED' || status === 'SKIPPED') return 0;
  const total = Number(input.totalCount);
  if (Number.isFinite(total) && total > 0) {
    const checked = Math.max(0, Number(input.checkedCount) || 0);
    return Math.min(100, Math.floor((checked / total) * 100));
  }
  const estimate = Number(input.estimatedMinutes);
  if (!Number.isFinite(estimate) || estimate <= 0) return 0;
  const elapsed = Math.max(0, Number(input.elapsedMinutes) || 0);
  return Math.min(100, Math.floor((elapsed / estimate) * 100));
}

export function liveStageProgressPercent(
  tasks: Array<{
    status?: string | null;
    elapsedMinutes?: number;
    estimatedMinutes?: number | null;
    timing?: { elapsedMinutes?: number; estimatedMinutes?: number | null };
  }>,
): number {
  if (!tasks.length) return 0;
  const percents = tasks.map((task) =>
    liveTaskProgressPercent({
      status: task.status,
      elapsedMinutes: task.timing?.elapsedMinutes ?? task.elapsedMinutes ?? 0,
      estimatedMinutes: task.timing?.estimatedMinutes ?? task.estimatedMinutes,
    }),
  );
  return Math.round(percents.reduce((sum, pct) => sum + pct, 0) / percents.length);
}

/** Same weighting as calculateWorkflowProgress, with paused work counting as in-progress. */
export function liveWorkflowProgressPercent(
  nodes: Array<{
    status?: string | null;
    progressPercent?: number | null;
    estimatedMinutes?: number | null;
    isSkipped?: boolean;
  }>,
): number {
  const active = nodes.filter(
    (n) => !n.isSkipped && statusUpper(n.status) !== 'SKIPPED',
  );
  if (!active.length) return 0;

  let total = 0;
  let completed = 0;
  for (const node of active) {
    const status = statusUpper(node.status);
    const weight =
      node.estimatedMinutes != null && node.estimatedMinutes > 0 ? node.estimatedMinutes : 1;
    total += weight;
    if (status === 'COMPLETED' || status === 'DONE') {
      completed += weight;
    } else if (
      status === 'IN_PROGRESS' ||
      status === 'PAUSED' ||
      status === 'BLOCKED' ||
      status === 'READY_FOR_INSPECTION' ||
      status === 'ACTIVE'
    ) {
      const pct = Math.min(100, Math.max(0, node.progressPercent ?? 0));
      completed += (weight * pct) / 100;
    }
  }
  if (total <= 0) return 0;
  return Math.round((100 * completed) / total);
}

export type TaskRowForLiveProgress = {
  status?: string | null;
  actualMinutes?: number | null;
  estimatedMinutes?: number | null;
  plannedCompletion?: Date | string | null;
  timeEntries?: Array<{ startedAt: Date | string; endedAt?: Date | string | null }>;
};

export function liveTimingFromTaskRow(
  task: TaskRowForLiveProgress,
  now?: Date,
): TaskTimingSummary {
  const entries = task.timeEntries ?? [];
  const open = entries.find((e) => !e.endedAt);
  const hasClosed = entries.some((e) => e.endedAt != null);
  return buildTaskTimingSummary({
    status: String(task.status ?? 'NOT_STARTED'),
    actualMinutes: task.actualMinutes,
    actualSeconds: hasClosed ? closedSecondsFromTimeEntries(entries) : undefined,
    estimatedMinutes: task.estimatedMinutes,
    plannedCompletion: task.plannedCompletion,
    openStartedAt: open?.startedAt ?? null,
    now,
  });
}

export function livePercentFromTaskRow(task: TaskRowForLiveProgress, now?: Date): number {
  const timing = liveTimingFromTaskRow(task, now);
  return liveTaskProgressPercent({
    status: task.status,
    elapsedMinutes: timing.elapsedMinutes,
    estimatedMinutes: timing.estimatedMinutes,
  });
}
