export type TaskTimeRow = {
  actualMinutes?: number | null;
  isRework?: boolean;
  stageCode?: string | null;
  stageNameEn?: string | null;
  stageNameAr?: string | null;
  stageNameHe?: string | null;
};

export function minutesBetween(start: Date | null | undefined, end: Date | null | undefined): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60_000);
}

/** Effort and wall-clock are two numbers. Never add them. */
export function aggregateFactoryTime(
  tasks: TaskTimeRow[],
  wall: { start?: Date | null; end?: Date | null },
) {
  let workerEffortMinutes = 0;
  let reworkEffortMinutes = 0;
  const byStage = new Map<
    string,
    { stageCode: string; workerEffortMinutes: number; reworkEffortMinutes: number }
  >();

  for (const task of tasks) {
    const minutes = Number(task.actualMinutes) || 0;
    workerEffortMinutes += minutes;
    if (task.isRework) reworkEffortMinutes += minutes;
    const code = task.stageCode || 'UNKNOWN';
    const current = byStage.get(code) ?? {
      stageCode: code,
      workerEffortMinutes: 0,
      reworkEffortMinutes: 0,
    };
    current.workerEffortMinutes += minutes;
    if (task.isRework) current.reworkEffortMinutes += minutes;
    byStage.set(code, current);
  }

  return {
    workerEffortMinutes,
    reworkEffortMinutes,
    firstPassEffortMinutes: Math.max(0, workerEffortMinutes - reworkEffortMinutes),
    wallClockMinutes: minutesBetween(wall.start ?? null, wall.end ?? null),
    byStage: [...byStage.values()],
  };
}
