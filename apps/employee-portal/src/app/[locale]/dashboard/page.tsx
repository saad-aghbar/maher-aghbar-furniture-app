'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import {
  Card,
  ErrorState,
  MetricCard,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, PauseCircle, PlayCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  productionOrder?: { number: string };
  stageDefinition?: { code: string; nameEn: string; nameAr?: string };
}

export default function EmployeeDashboard() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tProd = useTranslations('production');
  const tStatus = useTranslations('statuses');

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
  });

  const tasksQuery = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () =>
      apiFetch<{ data: Task[] }>('/api/v1/tasks?mine=true&pageSize=50').then((r) => r.data ?? []),
  });

  if (me.isLoading || tasksQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (tasksQuery.isError) {
    return <ErrorState title={t('dashboard')} onRetry={() => tasksQuery.refetch()} />;
  }

  const tasks = (tasksQuery.data ?? []).filter((x) => x.status !== 'COMPLETED');
  const ready = tasks.filter((x) => x.status === 'READY').length;
  const inProgress = tasks.filter((x) => x.status === 'IN_PROGRESS' || x.status === 'PAUSED').length;
  const blocked = tasks.filter((x) => x.status === 'BLOCKED').length;
  const focus = tasks
    .slice()
    .sort((a, b) => {
      const rank = (s: string) =>
        s === 'IN_PROGRESS' ? 0 : s === 'READY' ? 1 : s === 'PAUSED' ? 2 : 3;
      return rank(a.status) - rank(b.status);
    })
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${tCommon('welcome')}${me.data?.name ? `, ${me.data.name.split(' ')[0]}` : ''}`}
        description={tCommon('employeeDashboardSubtitle')}
      />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label={tProd('todayTasks')}
          value={tasks.length}
          tone="brand"
          icon={<ClipboardList className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          label={tStatus('READY')}
          value={ready}
          tone="info"
          icon={<PlayCircle className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          label={tStatus('IN_PROGRESS')}
          value={inProgress}
          tone="warning"
          icon={<PauseCircle className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          label={tStatus('BLOCKED')}
          value={blocked}
          tone="error"
          icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
        />
      </div>

      <Card
        title={t('tasks')}
        actions={
          <Link href="/tasks" className="inline-flex items-center gap-1 text-sm font-medium text-brand">
            {tCommon('viewAll')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        {focus.length === 0 ? (
          <p className="text-sm text-text-secondary">{tProd('empty')}</p>
        ) : (
          <ul className="space-y-3">
            {focus.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--maher-radius-md)] border border-border px-3 py-3 transition-colors hover:border-border-strong hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary">
                      {task.stageDefinition
                        ? localizedName(locale, task.stageDefinition, task.name)
                        : task.name}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {task.productionOrder?.number ?? '—'} · {task.progressPercent}%
                      {task.stageDefinition
                        ? ` · ${localizedName(locale, task.stageDefinition)}`
                        : ''}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
