/**
 * Human-controlled factory plan.
 * Condition changes may update warnings / attention / suggestions.
 * They must never persist schedule, assignment, sequence, or commercial dates.
 */

export const SCHEDULE_ATTENTION_CODES = [
  'FACTORY_CLOSED',
  'SCHEDULE_INVALID',
  'OVERTIME_REMOVED',
  'HOURS_REDUCED',
  'CAPACITY_REDUCED',
  'WORKER_UNAVAILABLE',
  'WORKER_CONFLICT',
  'DEPENDENCY_CONFLICT',
  'UNFINISHED_WORK',
  'NEXT_STAGE_MAY_START_EARLIER',
  'MATERIAL_RISK',
  'MATERIAL_READY',
  'REWORK_NEEDS_PLANNING',
  'OVER_CAPACITY',
  'COMMITTED_DATE_AT_RISK',
] as const;
export type ScheduleAttentionCode = (typeof SCHEDULE_ATTENTION_CODES)[number];

export const HARD_BLOCK_CODES = [
  'PREDECESSOR_NOT_COMPLETE',
  'SEMI_NOT_RECEIVED',
  'INVALID_TIME_RANGE',
  'FACTORY_CLOSED_EXECUTION',
  'MANDATORY_SKILL',
] as const;
export type HardBlockCode = (typeof HARD_BLOCK_CODES)[number];

export const WARNING_CODES = [
  'OVER_100_PERCENT',
  'WORKER_OVERTIME',
  'TIGHT_DELIVERY_BUFFER',
  'HIGH_DEPARTMENT_LOAD',
  'MATERIAL_RISK',
  'COMMITTED_DATE_AT_RISK',
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export type PersistClass = 'hard_block' | 'warning' | 'allowed';

export function classifyPersistIssue(code: string): PersistClass {
  if ((HARD_BLOCK_CODES as readonly string[]).includes(code)) return 'hard_block';
  if (
    code === 'NON_WORKING_START' ||
    code === 'INVALID_WINDOW' ||
    code === 'DEPENDENCY_ORDER' ||
    code === 'WORKER_NOT_ELIGIBLE'
  ) {
    return 'hard_block';
  }
  if ((WARNING_CODES as readonly string[]).includes(code)) return 'warning';
  if (
    code === 'WORKER_DOUBLE_BOOKED' ||
    code === 'WORKER_OVERLAP' ||
    code === 'PINNED_MOVED' ||
    code === 'SCHEDULE_CONFLICT'
  ) {
    return 'warning';
  }
  if (code === 'OVER_CAPACITY' || code === 'HIGH_LOAD') return 'warning';
  return 'allowed';
}

/** 110% / 120% factory load is a warning, never a hard block. */
export function loadPercentPersistClass(loadPercent: number): PersistClass {
  if (loadPercent > 100) return 'warning';
  return 'allowed';
}

export type DayLoadLayers = {
  date: string;
  isWorking: boolean;
  /** Calendar shift minutes (normal capacity). */
  normalCapacityMinutes: number;
  /** Owner target percent for this day (100, 120, 0=closed intent). */
  targetLoadPercent: number;
  /** Target minutes = normal * target/100. */
  targetCapacityMinutes: number;
  /** Sum of current manual allocations. */
  plannedMinutes: number;
  factoryLoadPercent: number;
  overtime: boolean;
  closed: boolean;
};

export function computeDayLoadLayers(input: {
  date: string;
  isWorking: boolean;
  normalCapacityMinutes: number;
  targetLoadPercent: number;
  plannedMinutes: number;
  overtime?: boolean;
}): DayLoadLayers {
  const normal = Math.max(0, input.normalCapacityMinutes);
  const targetPct = Math.max(0, input.targetLoadPercent);
  const planned = Math.max(0, input.plannedMinutes);
  const targetCapacityMinutes = Math.round((normal * targetPct) / 100);
  const factoryLoadPercent = normal > 0 ? Math.round((planned / normal) * 100) : 0;
  return {
    date: input.date,
    isWorking: input.isWorking,
    normalCapacityMinutes: Math.round(normal),
    targetLoadPercent: targetPct,
    targetCapacityMinutes,
    plannedMinutes: Math.round(planned),
    factoryLoadPercent,
    overtime: Boolean(input.overtime),
    closed: !input.isWorking || targetPct === 0,
  };
}

export type DayImpactPreview = {
  date: string;
  taskCount: number;
  orderCount: number;
  workerCount: number;
  committedDeliveryCount: number;
  allocationIds: string[];
  productionOrderIds: string[];
};

export function summarizeDayImpact(rows: Array<{
  allocationId: string;
  productionOrderId: string;
  employeeId?: string | null;
  committedDeliveryDate?: Date | string | null;
}>): Omit<DayImpactPreview, 'date'> {
  const orders = new Set<string>();
  const workers = new Set<string>();
  const committed = new Set<string>();
  const allocationIds: string[] = [];
  for (const row of rows) {
    allocationIds.push(row.allocationId);
    orders.add(row.productionOrderId);
    if (row.employeeId) workers.add(row.employeeId);
    if (row.committedDeliveryDate) committed.add(row.productionOrderId);
  }
  return {
    taskCount: rows.length,
    orderCount: orders.size,
    workerCount: workers.size,
    committedDeliveryCount: committed.size,
    allocationIds,
    productionOrderIds: [...orders],
  };
}

export type ReviewedAllocationMove = {
  allocationId?: string;
  productionTaskId?: string;
  employeeId: string | null;
  plannedStart: string;
  plannedEnd: string;
  sortOrder?: number;
};

export type BulkShiftPreviewRow = {
  allocationId: string;
  productionTaskId: string | null;
  employeeId: string | null;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
};

export const MANUAL_CONTROL_INVARIANT =
  'NO SCHEDULE, WORKER ASSIGNMENT, CAPACITY MOVE, OVERTIME MOVE, CALENDAR MOVE, CONFLICT RESOLUTION, LATE-TASK RIPPLE, EARLY-TASK ADVANCE, MATERIAL-DRIVEN MOVE, REWORK MOVE, OR COMMITTED DELIVERY DATE CHANGE OCCURS WITHOUT EXPLICIT AUTHORIZED HUMAN ACTION.';
