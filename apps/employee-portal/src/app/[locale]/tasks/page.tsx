'use client';

import { Link } from '@/i18n/navigation';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  plannedCompletion?: string;
}

export default function TasksPage() {
  const t = useTranslations('production');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/tasks?mine=true`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('failed');
      const json = (await res.json()) as { data?: Task[] } | Task[];
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError) return <ErrorState title={t('todayTasks')} onRetry={() => refetch()} />;

  const tasks = data ?? [];
  if (tasks.length === 0) return <EmptyState title={t('empty')} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('todayTasks')}</h1>
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/tasks/${task.id}`}
          className="block rounded-lg border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{task.name}</p>
              <p className="text-xs text-[var(--maher-text-secondary)]">{task.number}</p>
            </div>
            <StatusBadge status={task.status} />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full bg-brand" style={{ width: `${task.progressPercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-[var(--maher-text-secondary)]">
            {task.priority} · {task.progressPercent}%
          </p>
        </Link>
      ))}
    </div>
  );
}
