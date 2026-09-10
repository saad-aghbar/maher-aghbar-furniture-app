export const STAGE_STARTED_STATUSES = new Set([
  'IN_PROGRESS',
  'COMPLETED',
  'PAUSED',
  'READY_FOR_INSPECTION',
  'BLOCKED',
  'SKIPPED',
]);

function positiveMinutes(value?: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

/** dto → task → snapshot. Null when the stage has no time yet. */
export function resolveAssignStageMinutes(opts: {
  dtoMinutes?: number | null;
  taskMinutes?: number | null;
  snapshotMinutes?: number | null;
}): number | null {
  return (
    positiveMinutes(opts.dtoMinutes) ??
    positiveMinutes(opts.taskMinutes) ??
    positiveMinutes(opts.snapshotMinutes)
  );
}

/** Write assign-sheet duration back onto the workflow stage time. */
export function shouldWriteBackStageTime(opts: {
  dtoMinutes?: number | null;
  snapshotMinutes?: number | null;
  stageStatus?: string | null;
}): boolean {
  const next = positiveMinutes(opts.dtoMinutes);
  if (next == null) return false;
  if (next === positiveMinutes(opts.snapshotMinutes)) return false;
  if (opts.stageStatus && STAGE_STARTED_STATUSES.has(opts.stageStatus)) return false;
  return true;
}
