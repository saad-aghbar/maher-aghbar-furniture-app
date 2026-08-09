import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { WorkerHomeNotification, WorkerHomePayload, WorkerHomeTask } from './api';

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
 * Current task = in-progress first, else urgent/high, else next open.
 */
export function selectCurrentTask(data: WorkerHomePayload): WorkerHomeTask | null {
  const open = allOpenTasks(data);
  if (open.length === 0) return null;

  const inProgress = open.find((t) => String(t.status).toUpperCase() === 'IN_PROGRESS');
  if (inProgress) return inProgress;

  if (data.urgentTask) return data.urgentTask;

  const high = open.find((t) => {
    const p = String(t.priority).toLowerCase();
    return p === 'urgent' || p === 'high';
  });
  return high ?? open[0] ?? null;
}

export function selectUpcomingTasks(data: WorkerHomePayload): WorkerHomeTask[] {
  const current = selectCurrentTask(data);
  return allOpenTasks(data).filter((t) => t.id !== current?.id);
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
export function selectTodayProgress(data: WorkerHomePayload): TodayProgressBreakdown {
  const open = allOpenTasks(data);
  const inProgress = open.filter((t) => String(t.status).toUpperCase() === 'IN_PROGRESS').length;
  const remaining = Math.max(0, open.length - inProgress);
  const completed = data.completedTodayCount;
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
