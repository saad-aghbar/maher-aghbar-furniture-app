/**
 * Canonical planning-state classifier.
 * Distinguishes “the plan is not executable yet” from “the plan is ready but
 * worker/date/time placement is missing”.
 */

export const PLANNING_STATES = [
  'NEEDS_PLANNING',
  'READY_TO_SCHEDULE',
  'PARTIALLY_SCHEDULED',
  'SCHEDULED',
  'IN_PRODUCTION',
] as const;
export type PlanningState = (typeof PLANNING_STATES)[number];

const ON_FLOOR_ORDER = new Set([
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
]);

export const STARTED_TASK = new Set([
  'IN_PROGRESS',
  'PAUSED',
  'READY_FOR_INSPECTION',
  'COMPLETED',
  'BLOCKED',
]);

const SKIP_TASK = new Set(['CANCELLED']);

export type PlanningTaskFacts = {
  estimatedMinutes?: number | null;
  plannedStart?: Date | string | null;
  plannedCompletion?: Date | string | null;
  assignedEmployeeId?: string | null;
  status: string;
};

export type PlanningStateInput = {
  orderStatus: string;
  hasSnapshot: boolean;
  tasks: PlanningTaskFacts[];
};

function hasWindow(task: PlanningTaskFacts): boolean {
  return Boolean(task.plannedStart) && Boolean(task.plannedCompletion);
}

function hasDuration(task: PlanningTaskFacts): boolean {
  return typeof task.estimatedMinutes === 'number' && task.estimatedMinutes >= 0;
}

function isMilestoneTask(task: PlanningTaskFacts): boolean {
  return typeof task.estimatedMinutes === 'number' && task.estimatedMinutes === 0;
}

function isPlaced(task: PlanningTaskFacts): boolean {
  if (isMilestoneTask(task)) return hasWindow(task);
  return Boolean(task.assignedEmployeeId) && hasWindow(task);
}

/** Executable future (or waiting) tasks that still need a placement. */
export function requiredPlacementTasks(tasks: PlanningTaskFacts[]): PlanningTaskFacts[] {
  return tasks.filter((t) => !SKIP_TASK.has(t.status) && !STARTED_TASK.has(t.status));
}

export function classifyPlanningState(input: PlanningStateInput): PlanningState {
  const tasks = input.tasks ?? [];
  const required = requiredPlacementTasks(tasks);
  const started = tasks.some((t) => STARTED_TASK.has(t.status));
  const onFloor = ON_FLOOR_ORDER.has(input.orderStatus);
  const living = tasks.filter((t) => !SKIP_TASK.has(t.status));

  if (!input.hasSnapshot || living.length === 0 || living.some((t) => !hasDuration(t) && !STARTED_TASK.has(t.status))) {
    if (!started && !onFloor) return 'NEEDS_PLANNING';
    if (required.length === 0) return 'IN_PRODUCTION';
    if (required.some((t) => !hasDuration(t))) return 'NEEDS_PLANNING';
  }

  if (required.length > 0 && required.some((t) => !hasDuration(t))) {
    return 'NEEDS_PLANNING';
  }

  const placed = required.filter(isPlaced);
  if (required.length > 0 && placed.length === 0) {
    return started || onFloor ? 'PARTIALLY_SCHEDULED' : 'READY_TO_SCHEDULE';
  }
  if (required.length > 0 && placed.length < required.length) return 'PARTIALLY_SCHEDULED';
  if (started || onFloor) return 'IN_PRODUCTION';
  return required.length === 0 && !started ? 'NEEDS_PLANNING' : 'SCHEDULED';
}

/** KPI / unscheduled workspace: plan is executable but one or more placements are missing. */
export function isUnscheduledPlanningState(state: PlanningState): boolean {
  return state === 'READY_TO_SCHEDULE' || state === 'PARTIALLY_SCHEDULED';
}
