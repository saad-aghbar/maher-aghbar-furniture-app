import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { FloorTaskPhase } from '@/api/modules/tasks';
import type { TaskListItem } from '@/features/tasks/api';
import {
  bucketOpenTaskForToday,
  classifyTodayQualityStamp,
  type TodayFloorBucket,
  type TodayQualityStamp,
} from '@/features/tasks/floorPhase';
import type { WorkerHomeNotification, WorkerHomePayload, WorkerHomeTask } from './api';

export type { TodayFloorBucket, TodayQualityStamp };

export type WorkerHomeTaskFloorMeta = {
  phase?: FloorTaskPhase | null;
  needsReceive?: boolean | null;
  waitingPrevious?: boolean | null;
  qualityStamp?: TodayQualityStamp;
};

export type WorkerHomeTaskWithFloor = WorkerHomeTask & WorkerHomeTaskFloorMeta;

export function isWorkerHomeEmpty(data: WorkerHomePayload): boolean {
  return (
    data.completedTodayCount === 0 &&
    !data.urgentTask &&
    data.todaysTasks.length === 0 &&
    data.notifications.length === 0
  );
}

export function hasOpenTasks(data: WorkerHomePayload): boolean {
  return Boolean(data.urgentTask) || data.todaysTasks.length > 0;
}

/** All open tasks from home payload (urgent first when present). */
export function allOpenTasks(data: WorkerHomePayload): WorkerHomeTask[] {
  const rest = data.todaysTasks ?? [];
  if (!data.urgentTask) return rest;
  if (rest.some((t) => t.id === data.urgentTask!.id)) return rest;
  return [data.urgentTask, ...rest];
}

/**
 * Map a Tasks-tab list item into the Worker Home card shape.
 * Home Current / On deck must use this path so taps always open list-visible work.
 */
export function mapTaskListItemToWorkerHomeTask(
  item: TaskListItem,
  floor?: WorkerHomeTaskFloorMeta,
): WorkerHomeTaskWithFloor {
  const product = item.productionOrder?.product;
  const stage = item.stageDefinition;
  const orderNumber =
    item.salesOrderNumber ||
    item.productionOrder?.salesOrder?.number ||
    item.factoryOrderNumber ||
    item.productionOrder?.number ||
    item.number;
  const productTitle =
    product?.nameEn ||
    product?.nameAr ||
    product?.nameHe ||
    item.productionOrder?.productDescription ||
    item.name;
  const imageUrl =
    item.productImageUrl ||
    product?.imageUrl ||
    (Array.isArray(item.productImageUrls) ? item.productImageUrls[0] : null) ||
    null;
  const deadline = item.plannedCompletion ?? item.timing?.plannedCompletion ?? null;
  const estimatedMinutes =
    typeof item.estimatedMinutes === 'number' && item.estimatedMinutes > 0
      ? item.estimatedMinutes
      : item.timing?.estimatedMinutes ?? null;

  return {
    id: item.id,
    number: item.number,
    name: stage?.nameEn || item.name,
    nameEn: stage?.nameEn ?? null,
    nameAr: stage?.nameAr ?? null,
    nameHe: stage?.nameHe ?? null,
    priority: String(item.priority ?? 'NORMAL'),
    status: String(item.status ?? 'NOT_STARTED'),
    orderNumber,
    productTitle,
    productNameEn: product?.nameEn ?? null,
    productNameAr: product?.nameAr ?? null,
    productNameHe: product?.nameHe ?? null,
    imageUrl,
    deadline,
    estimatedMinutes,
    timing: item.timing
      ? {
          status: item.timing.status,
          actualMinutes: item.timing.actualMinutes,
          actualSeconds: item.timing.actualSeconds,
          openStartedAt: item.timing.openStartedAt,
          estimatedMinutes: item.timing.estimatedMinutes,
          plannedCompletion: item.timing.plannedCompletion,
          elapsedMinutes: item.timing.elapsedMinutes,
          plannedStart: item.timing.plannedStart ?? item.plannedStart ?? null,
        }
      : undefined,
    phase: floor?.phase ?? item.floorHint?.phase ?? null,
    needsReceive: floor?.needsReceive ?? item.needsWipReceive ?? null,
    waitingPrevious: floor?.waitingPrevious ?? null,
    qualityStamp:
      floor?.qualityStamp ??
      classifyTodayQualityStamp({
        stageCode: stage?.code,
        executionKind: stage?.executionKind,
        isRework: item.isRework,
      }),
  };
}

/**
 * Current task from the same open queue as the Tasks tab:
 * in-progress first, else urgent/high, else first open (API priority order).
 */
export function selectCurrentTaskFromOpen(open: WorkerHomeTask[]): WorkerHomeTask | null {
  if (open.length === 0) return null;

  const inProgress = open.find((t) => String(t.status).toUpperCase() === 'IN_PROGRESS');
  if (inProgress) return inProgress;

  const high = open.find((t) => {
    const p = String(t.priority).toLowerCase();
    return p === 'urgent' || p === 'high';
  });
  return high ?? open[0] ?? null;
}

export function selectUpcomingTasksFromOpen(open: WorkerHomeTask[]): WorkerHomeTask[] {
  const current = selectCurrentTaskFromOpen(open);
  return open.filter((t) => t.id !== current?.id);
}

/**
 * Current task = in-progress first, else urgent/high, else next open.
 * Prefer {@link selectCurrentTaskFromOpen} with the Tasks list for live Home.
 */
export function selectCurrentTask(data: WorkerHomePayload): WorkerHomeTask | null {
  const open = allOpenTasks(data);
  if (open.length === 0) return null;

  const inProgress = open.find((t) => String(t.status).toUpperCase() === 'IN_PROGRESS');
  if (inProgress) return inProgress;

  if (data.urgentTask) return data.urgentTask;

  return selectCurrentTaskFromOpen(open);
}

export function selectUpcomingTasks(data: WorkerHomePayload): WorkerHomeTask[] {
  return selectUpcomingTasksFromOpen(allOpenTasks(data));
}

/** Stage / department label for the active UI locale. */
export function localizedWorkerStageName(task: WorkerHomeTask, locale: Locale): string {
  return localizedName(
    locale,
    {
      nameEn: task.nameEn,
      nameAr: task.nameAr,
      nameHe: task.nameHe,
      name: task.name,
    },
    task.name || '—',
  );
}

/** Product / order title for the active UI locale. */
export function localizedWorkerProductTitle(task: WorkerHomeTask, locale: Locale): string {
  return localizedName(
    locale,
    {
      nameEn: task.productNameEn,
      nameAr: task.productNameAr,
      nameHe: task.productNameHe,
      name: task.productTitle,
    },
    task.productTitle || task.name || '—',
  );
}

export function localizedWorkerNotificationTitle(
  n: WorkerHomeNotification,
  locale: Locale,
): string {
  return localizedName(
    locale,
    {
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      name: n.title,
    },
    n.title || '—',
  );
}

export function localizedWorkerNotificationBody(
  n: WorkerHomeNotification,
  locale: Locale,
): string {
  return localizedName(
    locale,
    {
      titleEn: n.bodyEn,
      titleAr: n.bodyAr,
      name: n.body,
    },
    n.body || '',
  );
}

export type TodayProgressBreakdown = {
  completed: number;
  inProgress: number;
  remaining: number;
  totalToday: number;
  /** 0–1 share of completed vs today's load. */
  completedRatio: number;
  percentCompleted: number;
};

/**
 * Day progress from counts only — never uses task progressPercent.
 */
export function selectTodayProgressFromOpen(
  open: WorkerHomeTask[],
  completedTodayCount: number,
): TodayProgressBreakdown {
  const inProgress = open.filter((t) => String(t.status).toUpperCase() === 'IN_PROGRESS').length;
  const remaining = Math.max(0, open.length - inProgress);
  const completed = completedTodayCount;
  const totalToday = completed + inProgress + remaining;
  const completedRatio = totalToday > 0 ? completed / totalToday : 0;
  return {
    completed,
    inProgress,
    remaining,
    totalToday,
    completedRatio,
    percentCompleted: Math.round(completedRatio * 100),
  };
}

/**
 * Day progress from counts only — never uses task progressPercent.
 */
export function selectTodayProgress(data: WorkerHomePayload): TodayProgressBreakdown {
  return selectTodayProgressFromOpen(allOpenTasks(data), data.completedTodayCount);
}

/** Format minutes as `1h 30m` / `45m` / `2h`. */
export function formatEstimatedDuration(
  minutes: number | null | undefined,
  labels: { hour: string; minute: string },
): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const whole = Math.round(minutes);
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h > 0 && m > 0) return `${h}${labels.hour} ${m}${labels.minute}`;
  if (h > 0) return `${h}${labels.hour}`;
  return `${m}${labels.minute}`;
}

export type TodayFloorBuckets = {
  doNow: WorkerHomeTaskWithFloor[];
  readyAfterReceiving: WorkerHomeTaskWithFloor[];
  waiting: WorkerHomeTaskWithFloor[];
};

/**
 * Bucket open tasks for Worker Today (Delivery filtered by caller).
 * Prefer floorHint / claim needs when present; else status heuristics.
 */
export function selectTodayFloorBuckets(
  open: WorkerHomeTaskWithFloor[],
): TodayFloorBuckets {
  const doNow: WorkerHomeTaskWithFloor[] = [];
  const readyAfterReceiving: WorkerHomeTaskWithFloor[] = [];
  const waiting: WorkerHomeTaskWithFloor[] = [];

  for (const task of open) {
    const bucket = bucketOpenTaskForToday({
      status: task.status,
      phase: task.phase,
      needsReceive: task.needsReceive,
      waitingPrevious: task.waitingPrevious,
    });
    if (bucket === 'DO_NOW') doNow.push(task);
    else if (bucket === 'READY_AFTER_RECEIVING') readyAfterReceiving.push(task);
    else waiting.push(task);
  }

  return { doNow, readyAfterReceiving, waiting };
}

export function todayBucketLabelKey(
  bucket: Exclude<TodayFloorBucket, 'COMPLETED_TODAY'>,
): string {
  switch (bucket) {
    case 'DO_NOW':
      return 'mobile.tasks.todayBucketDoNow';
    case 'READY_AFTER_RECEIVING':
      return 'mobile.tasks.todayBucketReadyAfterReceiving';
    case 'WAITING':
      return 'mobile.tasks.todayBucketWaiting';
  }
}
