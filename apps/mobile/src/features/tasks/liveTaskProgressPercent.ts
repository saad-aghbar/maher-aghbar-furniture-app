/**
 * Timer-based floor percent: worked minutes / assigned minutes.
 * Caps at 100 while waiting for Finish — never 99, never auto-completes.
 */

export type LiveProgressInput = {
  status?: string | null;
  elapsedMinutes: number;
  estimatedMinutes?: number | null;
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

type LiveTimerFields = {
  status?: string | null;
  running?: boolean;
  openStartedAt?: string | Date | null;
  actualSeconds?: number | null;
  actualMinutes?: number | null;
  elapsedMinutes?: number | null;
  estimatedMinutes?: number | null;
};

export function liveElapsedFromTimer(input: LiveTimerFields, now?: Date | number): number {
  const running = Boolean(input.running) || String(input.status ?? '').toLowerCase() === 'running';
  const closed =
    input.actualSeconds != null && Number.isFinite(Number(input.actualSeconds))
      ? Math.max(0, Math.floor(Number(input.actualSeconds)))
      : 0;
  const fromClock = liveElapsedMinutes({
    running,
    openStartedAt: input.openStartedAt,
    closedSeconds: closed,
    now,
  });
  if (!running) return input.elapsedMinutes ?? fromClock;
  return Math.max(fromClock, input.elapsedMinutes ?? 0);
}

export function productionOrderHasRunningTimer(order: {
  tasks?: Array<{ timing?: { status?: string | null } | null } | null> | null;
  stages?: Array<{
    assignees?: Array<{ running?: boolean } | null> | null;
    tasks?: Array<{ timing?: { status?: string | null } | null } | null> | null;
  } | null> | null;
}): boolean {
  if (order.tasks?.some((t) => t?.timing?.status === 'running')) return true;
  return Boolean(
    order.stages?.some(
      (s) =>
        s?.assignees?.some((a) => a?.running) ||
        s?.tasks?.some((t) => t?.timing?.status === 'running'),
    ),
  );
}

type LiveTaskLike = {
  status?: string | null;
  progressPercent?: number | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  timing?: {
    status?: string;
    actualMinutes?: number;
    actualSeconds?: number;
    openStartedAt?: string | null;
    estimatedMinutes?: number | null;
    elapsedMinutes?: number;
  };
};

type LiveAssigneeLike = {
  running?: boolean;
  openStartedAt?: string | null;
  elapsedMinutes?: number;
  actualMinutes?: number;
  actualSeconds?: number;
  estimatedMinutes?: number | null;
};

type LiveStageLike = {
  status?: string | null;
  progressPercent?: number | null;
  isSkipped?: boolean;
  estimatedMinutes?: number | null;
  tasks?: LiveTaskLike[];
  assignees?: LiveAssigneeLike[];
};

function tickLiveTask<T extends LiveTaskLike>(task: T, now?: Date | number): T {
  const timing = task.timing;
  if (!timing) {
    return {
      ...task,
      progressPercent: liveTaskProgressPercent({
        status: task.status,
        elapsedMinutes: 0,
        estimatedMinutes: task.estimatedMinutes,
      }),
    };
  }
  const elapsed = liveElapsedFromTimer(
    {
      status: timing.status,
      openStartedAt: timing.openStartedAt,
      actualSeconds: timing.actualSeconds,
      actualMinutes: timing.actualMinutes,
      elapsedMinutes: timing.elapsedMinutes,
    },
    now,
  );
  const estimatedMinutes = timing.estimatedMinutes ?? task.estimatedMinutes;
  return {
    ...task,
    estimatedMinutes,
    progressPercent: liveTaskProgressPercent({
      status: task.status,
      elapsedMinutes: elapsed,
      estimatedMinutes,
    }),
    timing: { ...timing, elapsedMinutes: elapsed },
  };
}

function tickLiveStage<T extends LiveStageLike>(stage: T, now?: Date | number): T {
  const tasks = stage.tasks?.map((task) => tickLiveTask(task, now));
  const assignees = stage.assignees?.map((assignee) => {
    const elapsed = liveElapsedFromTimer(
      {
        running: assignee.running,
        openStartedAt: assignee.openStartedAt,
        actualSeconds: assignee.actualSeconds,
        actualMinutes: assignee.actualMinutes,
        elapsedMinutes: assignee.elapsedMinutes,
      },
      now,
    );
    return { ...assignee, elapsedMinutes: elapsed };
  });
  const progressPercent = tasks?.length
    ? liveStageProgressPercent(tasks)
    : assignees?.length
      ? liveStageProgressPercent(
          assignees.map((a) => ({
            status: stage.status,
            elapsedMinutes: a.elapsedMinutes ?? 0,
            estimatedMinutes: a.estimatedMinutes,
          })),
        )
      : liveTaskProgressPercent({
          status: stage.status,
          elapsedMinutes: 0,
          estimatedMinutes: stage.estimatedMinutes,
        });
  const estimatedMinutes =
    stage.estimatedMinutes ??
    tasks?.reduce((sum, t) => sum + (t.estimatedMinutes ?? t.timing?.estimatedMinutes ?? 0), 0) ??
    assignees?.reduce((sum, a) => sum + (a.estimatedMinutes ?? 0), 0) ??
    null;
  return {
    ...stage,
    ...(tasks ? { tasks } : {}),
    ...(assignees ? { assignees } : {}),
    progressPercent,
    estimatedMinutes: estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : stage.estimatedMinutes,
  };
}

export function withLiveProductionOrder<T extends {
  progressPercent?: number | null;
  tasks?: LiveTaskLike[];
  stages?: LiveStageLike[];
}>(order: T, now?: Date | number): T {
  const tasks = order.tasks?.map((task) => tickLiveTask(task, now));
  const stages = order.stages?.map((stage) => tickLiveStage(stage, now));
  const progressPercent = stages?.length
    ? liveWorkflowProgressPercent(stages)
    : tasks?.length
      ? liveWorkflowProgressPercent(
          tasks.map((t) => ({
            status: t.status,
            progressPercent: t.progressPercent,
            estimatedMinutes: t.estimatedMinutes ?? t.timing?.estimatedMinutes,
          })),
        )
      : 0;
  return {
    ...order,
    ...(tasks ? { tasks } : {}),
    ...(stages ? { stages } : {}),
    progressPercent,
  };
}
