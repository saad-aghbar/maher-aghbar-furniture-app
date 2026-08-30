import { Prisma, TaskStatus } from '@maher/database';

/** Open statuses a floor worker may see (prereqs unlocked / work started). */
export const WORKER_OPEN_ACTIONABLE: TaskStatus[] = [
  TaskStatus.READY,
  TaskStatus.IN_PROGRESS,
  TaskStatus.PAUSED,
  TaskStatus.BLOCKED,
  TaskStatus.READY_FOR_INSPECTION,
];

const UNLOCKED_STAGE_STATUSES = ['READY', 'IN_PROGRESS'] as const;

/** Floor workers do not work delivery stages (matches mobile Tasks tab). */
export const WORKER_EXCLUDED_STAGE_CODES = ['DELIVERY'] as const;

/**
 * True when a worker must not see this task yet — stage still waiting on priors.
 * Completed/cancelled own tasks remain visible (history).
 */
export function isPrereqLockedForWorker(task: {
  status: string;
  stageInstance?: { status: string } | null;
}): boolean {
  if (
    task.status === TaskStatus.COMPLETED ||
    task.status === TaskStatus.CANCELLED ||
    WORKER_OPEN_ACTIONABLE.includes(task.status as TaskStatus)
  ) {
    return false;
  }
  const stageStatus = task.stageInstance?.status;
  return stageStatus !== 'READY' && stageStatus !== 'IN_PROGRESS';
}

/** AND clauses: open status + unlocked stage (or already actionable). */
export function workerOpenActionableClauses(): Prisma.ProductionTaskWhereInput[] {
  return [
    { status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
    {
      OR: [
        { status: { in: WORKER_OPEN_ACTIONABLE } },
        {
          status: TaskStatus.NOT_STARTED,
          stageInstance: { status: { in: [...UNLOCKED_STAGE_STATUSES] } },
        },
      ],
    },
  ];
}

/**
 * Prisma where for open tasks a floor worker may act on:
 * READY / in-progress / etc., or NOT_STARTED once the stage is unlocked.
 */
export function workerOpenActionableWhere(): Prisma.ProductionTaskWhereInput {
  return { AND: workerOpenActionableClauses() };
}

/** Exclude stages that are not floor-worker work (e.g. DELIVERY). */
export function workerExcludeNonFloorStagesWhere(): Prisma.ProductionTaskWhereInput {
  return {
    NOT: { stageDefinition: { code: { in: [...WORKER_EXCLUDED_STAGE_CODES] } } },
  };
}

/** Flat AND clauses for floor open lists (actionable + non-DELIVERY). */
export function workerFloorOpenClauses(): Prisma.ProductionTaskWhereInput[] {
  return [...workerOpenActionableClauses(), workerExcludeNonFloorStagesWhere()];
}

/**
 * Open assigned tasks for worker home / floor lists:
 * assignee + actionable unlock filter + non-floor stage exclusion.
 */
export function workerFloorOpenTasksWhere(
  assigneeId: string,
): Prisma.ProductionTaskWhereInput {
  return {
    assignedEmployeeId: assigneeId,
    AND: workerFloorOpenClauses(),
  };
}
