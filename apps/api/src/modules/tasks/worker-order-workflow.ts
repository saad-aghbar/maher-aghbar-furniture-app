import { isPrereqLockedForWorker } from '../production/worker-task-visibility';
import { liveTimingFromTaskRow } from '../../common/helpers/live-task-progress';
import {
  DEFAULT_FACTORY_TIMEZONE,
  ymdInTimezone,
} from '../production/production-day-lens';

export type WorkerTaskLock =
  | { kind: 'open' }
  | { kind: 'needs_receive'; fromStageName: string }
  | { kind: 'locked'; reason: 'PREDECESSOR_NOT_COMPLETE'; waitingOnStageName: string }
  | { kind: 'done' };

export type MyOrderSegment = 'open' | 'today' | 'active';

const REMAINING_EXCLUDED = new Set(['COMPLETED', 'CANCELLED']);

export function remainingAssignedTasks<T extends { status: string }>(tasks: T[]): T[] {
  return tasks.filter((task) => !REMAINING_EXCLUDED.has(task.status));
}

export function summarizeAssignedOrderTasks(
  tasks: Array<{ status: string; stageInstance?: { status: string } | null }>,
) {
  const remaining = remainingAssignedTasks(tasks);
  const blockedCount = remaining.filter((task) => isPrereqLockedForWorker(task)).length;
  return {
    myTaskCount: remaining.length,
    actionableCount: remaining.length - blockedCount,
    blockedCount,
  };
}

export function parseMyOrderSegment(raw?: string | null): MyOrderSegment {
  if (raw === 'today' || raw === 'active') return raw;
  return 'open';
}

function factoryYmd(
  value: Date | string | null | undefined,
  timezone: string,
): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return ymdInTimezone(d, timezone);
}

export function isSameFactoryDay(
  value: Date | string | null | undefined,
  now: Date = new Date(),
  timezone: string = DEFAULT_FACTORY_TIMEZONE,
): boolean {
  const a = factoryYmd(value, timezone);
  const b = ymdInTimezone(now, timezone);
  return Boolean(a && a === b);
}

/** Hide until the factory-local plannedStart day; null or past/today stays visible. */
export function taskVisibleOnProductionDay(
  task: { plannedStart?: Date | string | null },
  now: Date = new Date(),
  timezone: string = DEFAULT_FACTORY_TIMEZONE,
): boolean {
  const startYmd = factoryYmd(task.plannedStart, timezone);
  if (!startYmd) return true;
  return startYmd <= ymdInTimezone(now, timezone);
}

export function taskDueToday(
  task: { plannedStart?: Date | string | null; plannedCompletion?: Date | string | null },
  orderDeadline: Date | string | null,
  now: Date = new Date(),
  timezone: string = DEFAULT_FACTORY_TIMEZONE,
): boolean {
  const today = ymdInTimezone(now, timezone);
  const completionYmd = factoryYmd(task.plannedCompletion, timezone);
  const deadlineYmd = factoryYmd(orderDeadline, timezone);
  if (completionYmd === today || deadlineYmd === today) return true;
  if (completionYmd && completionYmd < today) return true;
  if (deadlineYmd && deadlineYmd < today) return true;
  return false;
}

export type SegmentTask = {
  status: string;
  plannedStart?: Date | string | null;
  plannedCompletion?: Date | string | null;
  stageInstance?: { status: string } | null;
};

export function remainingTasksForSegment<T extends SegmentTask>(
  segment: MyOrderSegment,
  tasks: T[],
  orderDeadline: Date | string | null,
  now: Date = new Date(),
  timezone: string = DEFAULT_FACTORY_TIMEZONE,
): T[] {
  const remaining = remainingAssignedTasks(tasks).filter((task) =>
    taskVisibleOnProductionDay(task, now, timezone),
  );
  if (segment === 'open') return remaining;
  if (segment === 'active') return remaining.filter((task) => task.status === 'IN_PROGRESS');
  return remaining.filter((task) => taskDueToday(task, orderDeadline, now, timezone));
}

export function orderMatchesSegment(
  segment: MyOrderSegment,
  tasks: SegmentTask[],
  orderDeadline: Date | string | null,
  now: Date = new Date(),
  timezone: string = DEFAULT_FACTORY_TIMEZONE,
): boolean {
  return remainingTasksForSegment(segment, tasks, orderDeadline, now, timezone).length > 0;
}

function searchTokens(needle: string): string[] {
  return needle.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function compactSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\u0590-\u05ff]+/g, '');
}

export type WorkerOrderSearchRow = {
  number: string;
  productDescription?: string | null;
  variantLabel?: string | null;
  variantSku?: string | null;
  product?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
  salesOrder?: {
    number?: string | null;
    externalOrderNumber?: string | null;
    customer?: {
      code?: string | null;
      name?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
      companyName?: string | null;
    } | null;
  } | null;
  tasks?: Array<{
    stageDefinition?: {
      code?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
    } | null;
  }>;
};

export function workerOrderSearchHaystack(order: WorkerOrderSearchRow): string {
  const dealer = order.salesOrder?.customer;
  const parts = [
    order.number,
    order.salesOrder?.number,
    order.salesOrder?.externalOrderNumber,
    order.productDescription,
    order.variantLabel,
    order.variantSku,
    order.product?.nameEn,
    order.product?.nameAr,
    order.product?.nameHe,
    dealer?.code,
    dealer?.name,
    dealer?.nameEn,
    dealer?.nameAr,
    dealer?.nameHe,
    dealer?.companyName,
    ...(order.tasks ?? []).flatMap((task) => [
      task.stageDefinition?.code,
      task.stageDefinition?.nameEn,
      task.stageDefinition?.nameAr,
      task.stageDefinition?.nameHe,
    ]),
  ].filter((value): value is string => Boolean(value));
  const raw = parts.join(' ').toLowerCase();
  const compact = parts.map(compactSearchValue).filter(Boolean).join(' ');
  return `${raw} ${compact}`;
}

export function workerOrderMatchesSearch(order: WorkerOrderSearchRow, needle: string): boolean {
  const tokens = searchTokens(needle);
  if (tokens.length === 0) return true;
  const haystack = workerOrderSearchHaystack(order);
  return tokens.every(
    (token) => haystack.includes(token) || haystack.includes(compactSearchValue(token)),
  );
}

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  MEDIUM: 2,
  LOW: 3,
};

function higherPriority(a: string, b: string): string {
  const ra = PRIORITY_RANK[a.toUpperCase()] ?? 9;
  const rb = PRIORITY_RANK[b.toUpperCase()] ?? 9;
  return ra <= rb ? a : b;
}

function earlierDeadline(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
): Date | string | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

export type WorkerMyOrderGroupItem = {
  id: string;
  salesOrderId?: string | null;
  salesOrderNumber?: string | null;
  externalOrderNumber?: string | null;
  dealer?: unknown;
  deadline?: Date | string | null;
  priority: string;
  myTaskCount: number;
  actionableCount: number;
  blockedCount: number;
};

export type WorkerMySalesOrderGroup<T extends WorkerMyOrderGroupItem> = {
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  externalOrderNumber: string | null;
  dealer: T['dealer'] | null;
  deadline: Date | string | null;
  priority: string;
  myTaskCount: number;
  actionableCount: number;
  blockedCount: number;
  items: T[];
};

/** One floor card per sales order; orphan production orders stay their own card. */
export function groupMyOrdersBySalesOrder<T extends WorkerMyOrderGroupItem>(
  items: T[],
): WorkerMySalesOrderGroup<T>[] {
  const groups: WorkerMySalesOrderGroup<T>[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const key = item.salesOrderId?.trim() || `po:${item.id}`;
    const idx = indexByKey.get(key);
    if (idx == null) {
      indexByKey.set(key, groups.length);
      groups.push({
        salesOrderId: item.salesOrderId ?? null,
        salesOrderNumber: item.salesOrderNumber ?? null,
        externalOrderNumber: item.externalOrderNumber ?? null,
        dealer: item.dealer ?? null,
        deadline: item.deadline ?? null,
        priority: item.priority,
        myTaskCount: item.myTaskCount,
        actionableCount: item.actionableCount,
        blockedCount: item.blockedCount,
        items: [item],
      });
      continue;
    }
    const group = groups[idx]!;
    group.items.push(item);
    group.myTaskCount += item.myTaskCount;
    group.actionableCount += item.actionableCount;
    group.blockedCount += item.blockedCount;
    group.priority = higherPriority(group.priority, item.priority);
    group.deadline = earlierDeadline(group.deadline, item.deadline);
    if (!group.dealer && item.dealer) group.dealer = item.dealer;
    if (!group.salesOrderNumber && item.salesOrderNumber) {
      group.salesOrderNumber = item.salesOrderNumber;
    }
    if (!group.externalOrderNumber && item.externalOrderNumber) {
      group.externalOrderNumber = item.externalOrderNumber;
    }
  }
  return groups;
}

export function joinWaitOnNames(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return 'previous stage';
  return unique.join(' · ');
}

export type WorkflowLaneNode = {
  id: string;
  kind: 'task' | 'context';
  taskId: string | null;
  assignedToMe: boolean;
  stageCode: string;
  stageName: string;
  nameEn: string;
  nameAr: string | null;
  nameHe: string | null;
  status: string;
  sortOrder: number;
  dependsOnIds: string[];
  dependsOnCodes: string[];
  dependsOnNames: string[];
  lockState: WorkerTaskLock;
  plannedStart: string | null;
  plannedCompletion: string | null;
  estimatedMinutes?: number | null;
  elapsedMinutes?: number;
  actualSeconds?: number;
  openStartedAt?: string | null;
};

export function classifyWorkerTaskLock(input: {
  taskStatus: string;
  stageInstanceStatus: string | null;
  waitingOnStageName: string | null;
  needsReceive: boolean;
  receiveFromStageName: string | null;
}): WorkerTaskLock {
  if (input.taskStatus === 'COMPLETED') {
    return { kind: 'done' };
  }
  if (
    isPrereqLockedForWorker({
      status: input.taskStatus,
      stageInstance: input.stageInstanceStatus ? { status: input.stageInstanceStatus } : null,
    })
  ) {
    return {
      kind: 'locked',
      reason: 'PREDECESSOR_NOT_COMPLETE',
      waitingOnStageName: input.waitingOnStageName ?? 'previous stage',
    };
  }
  if (input.needsReceive) {
    return {
      kind: 'needs_receive',
      fromStageName: input.receiveFromStageName ?? input.waitingOnStageName ?? 'previous stage',
    };
  }
  return { kind: 'open' };
}

export type SnapshotLaneInput = {
  id: string;
  sortOrder: number;
  stageCode: string;
  stageName: string;
  nameEn: string;
  nameAr: string | null;
  nameHe: string | null;
  stageStatus: string;
  assignedToWorker: boolean;
  task: {
    id: string;
    status: string;
    plannedStart: Date | null;
    plannedCompletion: Date | null;
    stageInstanceStatus: string | null;
    estimatedMinutes?: number | null;
    actualMinutes?: number | null;
    timeEntries?: Array<{ startedAt: Date | string; endedAt?: Date | string | null }>;
  } | null;
  predecessorIds: string[];
  predecessorCodes: string[];
  predecessorNames: string[];
  unfinishedPredecessorNames: string[];
  predecessorComplete: boolean;
  needsReceive: boolean;
  receiveFromStageName: string | null;
};

function lockForUnassigned(input: SnapshotLaneInput): WorkerTaskLock {
  if (input.stageStatus === 'COMPLETED' || input.stageStatus === 'SKIPPED') {
    return { kind: 'done' };
  }
  if (input.unfinishedPredecessorNames.length > 0) {
    return {
      kind: 'locked',
      reason: 'PREDECESSOR_NOT_COMPLETE',
      waitingOnStageName: joinWaitOnNames(input.unfinishedPredecessorNames),
    };
  }
  return { kind: 'open' };
}

/**
 * Full frozen snapshot DAG for the worker lane — every station, not a slice
 * between the worker's first and last assigned task.
 */
export function buildWorkerOrderLane(nodes: SnapshotLaneInput[]): WorkflowLaneNode[] {
  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node) => {
      const waitOn = joinWaitOnNames(node.unfinishedPredecessorNames);
      const assigned = Boolean(node.assignedToWorker && node.task);
      const timing = node.task
        ? liveTimingFromTaskRow({
            status: node.task.status,
            actualMinutes: node.task.actualMinutes,
            estimatedMinutes: node.task.estimatedMinutes,
            plannedCompletion: node.task.plannedCompletion,
            timeEntries: node.task.timeEntries,
          })
        : null;
      const lockState = assigned
        ? classifyWorkerTaskLock({
            taskStatus: node.task!.status,
            stageInstanceStatus: node.task!.stageInstanceStatus,
            waitingOnStageName: waitOn,
            needsReceive: node.needsReceive,
            receiveFromStageName: node.receiveFromStageName,
          })
        : lockForUnassigned(node);
      return {
        id: node.id,
        kind: assigned ? 'task' : 'context',
        taskId: assigned ? node.task!.id : null,
        assignedToMe: assigned,
        stageCode: node.stageCode,
        stageName: node.stageName,
        nameEn: node.nameEn,
        nameAr: node.nameAr,
        nameHe: node.nameHe,
        status: assigned ? node.task!.status : node.stageStatus,
        sortOrder: node.sortOrder,
        dependsOnIds: node.predecessorIds,
        dependsOnCodes: node.predecessorCodes,
        dependsOnNames: node.predecessorNames,
        lockState,
        plannedStart: assigned ? (node.task!.plannedStart?.toISOString() ?? null) : null,
        plannedCompletion: assigned
          ? (node.task!.plannedCompletion?.toISOString() ?? null)
          : null,
        estimatedMinutes: timing?.estimatedMinutes ?? node.task?.estimatedMinutes ?? null,
        elapsedMinutes: timing?.elapsedMinutes ?? 0,
        actualSeconds: timing?.actualSeconds ?? 0,
        openStartedAt: timing?.openStartedAt ?? null,
      };
    });
}

export function summarizeLane(nodes: WorkflowLaneNode[]) {
  const tasks = nodes.filter((n) => n.kind === 'task');
  return {
    myTaskCount: tasks.length,
    actionableCount: tasks.filter(
      (t) => t.lockState.kind === 'open' || t.lockState.kind === 'needs_receive',
    ).length,
    blockedCount: tasks.filter((t) => t.lockState.kind === 'locked').length,
  };
}
