'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import {
  EmptyState,
  ErrorState,
  FloorBoard,
  MetricCard,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type WorkerHomeTask = {
  id: string;
  number: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  priority: string;
  status: string;
  orderNumber: string;
  productTitle: string;
  productNameEn?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  imageUrl: string | null;
  deadline: string | null;
  estimatedMinutes: number | null;
};

type WorkerHomePayload = {
  completedTodayCount: number;
  unreadNotifications: number;
  urgentTask: WorkerHomeTask | null;
  todaysTasks: WorkerHomeTask[];
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    titleEn?: string | null;
    titleAr?: string | null;
    createdAt: string;
    readAt: string | null;
  }>;
};

function greetingKey(date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function allOpen(data: WorkerHomePayload): WorkerHomeTask[] {
  const rest = data.todaysTasks ?? [];
  if (!data.urgentTask) return rest;
  if (rest.some((t) => t.id === data.urgentTask!.id)) return rest;
  return [data.urgentTask, ...rest];
}

function currentTask(data: WorkerHomePayload): WorkerHomeTask | null {
  const open = allOpen(data);
  if (!open.length) return null;
  const inProgress = open.find((t) => String(t.status).toUpperCase() === 'IN_PROGRESS');
  if (inProgress) return inProgress;
  if (data.urgentTask) return data.urgentTask;
  return open[0] ?? null;
}

export default function WorkerHomePage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('mobile');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<{ name?: string }>('/api/v1/auth/me'),
  });

  const query = useQuery({
    queryKey: ['worker-home'],
    queryFn: () =>
      apiFetch<WorkerHomePayload>('/api/v1/reports/worker-home', {
        headers: { 'Accept-Language': locale },
      }),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={t('workerHome.errorTitle')}
        description={t('workerHome.errorBody')}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  const open = allOpen(data);
  const current = currentTask(data);
  const upcoming = open.filter((t) => t.id !== current?.id);
  const inProgress = open.filter((t) => String(t.status).toUpperCase() === 'IN_PROGRESS').length;
  const remaining = Math.max(0, open.length - inProgress);
  const empty = data.completedTodayCount === 0 && open.length === 0;
  const name = me.data?.name ?? t('workerHome.fallbackName');

  return (
    <div className="space-y-4">
      <FloorBoard>
        <h1 className="text-2xl font-semibold text-[var(--maher-text-primary)]">
          {t(`workerHome.greeting.${greetingKey()}`, { name })}
        </h1>
        <p className="mt-1 text-sm text-[var(--maher-text-secondary)]">
          {tCommon('employeeDashboardSubtitle')}
        </p>
      </FloorBoard>

      <div className="grid grid-cols-3 gap-2">
        <MetricCard label={t('workerHome.progressDone')} value={data.completedTodayCount} tone="success" />
        <MetricCard label={t('workerHome.progressInProgress')} value={inProgress} tone="brand" />
        <MetricCard label={t('workerHome.progressRemaining')} value={remaining} tone="neutral" />
      </div>

      {empty ? (
        <EmptyState title={t('workerHome.emptyTitle')} description={t('workerHome.emptyBody')} />
      ) : null}

      {current ? (
        <Link href={`/worker/tasks/${current.id}`} className="block">
          <FloorBoard
            header={
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--maher-text-primary)]">
                  {t('workerHome.currentTask')}
                </p>
                <StatusBadge status={current.status} />
              </div>
            }
          >
            <p className="font-semibold text-[var(--maher-text-primary)]">
              {localizedName(
                locale,
                {
                  nameEn: current.nameEn,
                  nameAr: current.nameAr,
                  nameHe: current.nameHe,
                  name: current.name,
                },
                current.name,
              )}
            </p>
            <p className="mt-1 text-sm text-[var(--maher-text-secondary)]">
              {localizedName(
                locale,
                {
                  nameEn: current.productNameEn,
                  nameAr: current.productNameAr,
                  nameHe: current.productNameHe,
                  name: current.productTitle,
                },
                current.productTitle,
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--maher-text-tertiary)]" dir="ltr">
              {current.orderNumber}
            </p>
          </FloorBoard>
        </Link>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-text-primary">{t('workerHome.upcomingTasks')}</p>
          {upcoming.map((task) => (
            <Link key={task.id} href={`/worker/tasks/${task.id}`} className="block">
              <FloorBoard
                header={
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-[var(--maher-text-primary)]">
                      {localizedName(
                        locale,
                        { nameEn: task.nameEn, nameAr: task.nameAr, nameHe: task.nameHe, name: task.name },
                        task.name,
                      )}
                    </p>
                    <StatusBadge status={task.status} />
                  </div>
                }
              >
                <p className="truncate text-xs text-[var(--maher-text-tertiary)]" dir="ltr">
                  {task.orderNumber}
                </p>
              </FloorBoard>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Link
          href="/worker/tasks"
          className="text-sm font-medium text-brand hover:underline"
        >
          {tNav('tasks')}
        </Link>
        <Link
          href="/worker/tasks/completed"
          className="text-sm font-medium text-brand hover:underline"
        >
          {t('workerHome.seeCompleted')}
        </Link>
      </div>
    </div>
  );
}
