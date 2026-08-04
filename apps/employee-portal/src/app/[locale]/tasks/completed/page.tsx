'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  PageHero,
  Skeleton,
  StatusBadge,
  StaggerGrid,
  SurfaceCard,
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

export default function CompletedTasksPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tProd = useTranslations('production');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-tasks-completed'],
    queryFn: () =>
      apiFetch<{ data: Task[] }>('/api/v1/tasks?mine=true&pageSize=50').then((r) => r.data ?? []),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('completeTask')} onRetry={() => refetch()} />;
  }

  const tasks = (data ?? []).filter((task) => task.status === 'COMPLETED');

  return (
    <div className="space-y-4">
      <PageHero
        tone="soft"
        title={t('completeTask')}
        description={tCommon('employeeTasksSubtitle')}
      />

      {tasks.length === 0 ? (
        <EmptyState title={tProd('empty')} description={tCommon('employeeTasksEmptyHint')} />
      ) : (
        <StaggerGrid className="space-y-3">
          {tasks.map((task) => (
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
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <p className="mt-2 text-xs tabular-nums text-text-secondary">
                  {tProd('priority')}: {task.priority} · {task.progressPercent}%
                </p>
              </SurfaceCard>
            </Link>
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}
