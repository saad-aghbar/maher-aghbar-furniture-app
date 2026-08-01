'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  productionOrder?: {
    number: string;
    productDescription?: string;
  };
  stageDefinition?: {
    code: string;
    nameEn: string;
    nameAr?: string;
    dependsOnCodes?: string[];
  };
}

export default function TasksPage() {
  const locale = useLocale();
  const t = useTranslations('production');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () =>
      apiFetch<{ data: Task[] }>('/api/v1/tasks?mine=true&pageSize=50').then((r) => r.data ?? []),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('todayTasks')} onRetry={() => refetch()} />;
  }

  const tasks = (data ?? []).filter((task) => task.status !== 'COMPLETED');

  return (
    <div className="space-y-4">
      <PageHeader title={t('todayTasks')} description={tCommon('employeeTasksSubtitle')} />

      {tasks.length === 0 ? (
        <EmptyState title={t('empty')} description={tCommon('employeeTasksEmptyHint')} />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const locked = task.status === 'NOT_STARTED';
            const waiting = task.stageDefinition?.dependsOnCodes?.length
              ? task.stageDefinition.dependsOnCodes.join(', ')
              : null;
            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block rounded-[var(--maher-radius-lg)] border border-border bg-surface p-4 shadow-card transition-all active:scale-[0.99] hover:border-border-strong hover:shadow-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">
                      {task.stageDefinition
                        ? localizedName(locale, task.stageDefinition, task.name)
                        : task.name}
                    </p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {task.productionOrder?.number ?? '—'} · {task.number}
                    </p>
                    {task.productionOrder?.productDescription ? (
                      <p className="mt-1 truncate text-xs text-text-secondary">
                        {task.productionOrder.productDescription}
                      </p>
                    ) : null}
                    {task.stageDefinition ? (
                      <p className="mt-1 truncate text-xs text-text-secondary">
                        {t('stage')}: {localizedName(locale, task.stageDefinition)}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                {locked && waiting ? (
                  <p className="mt-3 text-xs text-[var(--maher-warning)]">
                    {t('waitingFor')}: {waiting}
                  </p>
                ) : null}
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${task.progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs tabular-nums text-text-secondary">
                  {t('priority')}: {task.priority} · {task.progressPercent}%
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
