'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  Badge,
  EmptyState,
  ErrorState,
  Ltr,
  PageHero,
  Skeleton,
  StatusBadge,
  StaggerGrid,
  SurfaceCard,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { isScheduledForToday, toDateOnly } from '@/lib/scheduling';

interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  plannedStart?: string | null;
  plannedCompletion?: string | null;
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
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('todayTasks')} onRetry={() => refetch()} />;
  }

  const tasks = (data ?? []).filter((task) => task.status !== 'COMPLETED');

  return (
    <div className="space-y-4">
      <PageHero tone="soft" title={t('todayTasks')} description={tCommon('employeeTasksSubtitle')} />

      {tasks.length === 0 ? (
        <EmptyState title={t('empty')} description={tCommon('employeeTasksEmptyHint')} />
      ) : (
        <StaggerGrid className="space-y-3">
          {tasks.map((task) => {
            const locked = task.status === 'NOT_STARTED';
            const waiting = task.stageDefinition?.dependsOnCodes?.length
              ? task.stageDefinition.dependsOnCodes.join(', ')
              : null;
            const scheduledToday =
              isScheduledForToday(task.plannedStart) || isScheduledForToday(task.plannedCompletion);
            return (
              <Link key={task.id} href={`/tasks/${task.id}`} className="block">
                <SurfaceCard tilt className="maher-list-card maher-press p-4">
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
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={task.status} />
                      {scheduledToday ? (
                        <Badge variant="brand">
                          <CalendarClock className="h-3 w-3" />
                          {t('scheduledForToday')}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {locked && waiting ? (
                    <p className="mt-3 text-xs text-[var(--maher-warning)]">
                      {t('waitingFor')}: {waiting}
                    </p>
                  ) : null}
                  {task.plannedStart || task.plannedCompletion ? (
                    <p className="mt-3 text-xs text-text-secondary">
                      {task.plannedStart ? (
                        <>
                          {t('plannedStart')}: <Ltr>{toDateOnly(task.plannedStart)}</Ltr>
                        </>
                      ) : null}
                      {task.plannedStart && task.plannedCompletion ? ' · ' : ''}
                      {task.plannedCompletion ? (
                        <>
                          {t('plannedCompletion')}: <Ltr>{toDateOnly(task.plannedCompletion)}</Ltr>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-text-secondary">
                    {t('priority')}: {task.priority}
                  </p>
                </SurfaceCard>
              </Link>
            );
          })}
        </StaggerGrid>
      )}
    </div>
  );
}
