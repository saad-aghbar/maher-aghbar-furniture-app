'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import { API_URL } from '@/lib/api-client';
import { Board, BoardSkeleton, Button, ErrorBoard, Figure, ListRow, ListRows, Ltr, Ribbon, RowThumb, Stamp, type BoardTone } from '@maher/ui';
import { Armchair, ArrowRight, CheckCircle2 } from 'lucide-react';
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

function statusTone(status: string): BoardTone {
  const key = status.toUpperCase();
  if (key === 'IN_PROGRESS') return 'brand';
  if (key === 'COMPLETED' || key === 'DONE') return 'success';
  if (key === 'PAUSED' || key === 'BLOCKED' || key === 'ON_HOLD') return 'warning';
  if (key === 'READY' || key === 'PENDING' || key === 'ASSIGNED') return 'info';
  return 'neutral';
}

function priorityTone(priority: string): BoardTone {
  const key = priority.toUpperCase();
  if (key === 'URGENT' || key === 'CRITICAL' || key === 'HIGH') return 'error';
  if (key === 'MEDIUM' || key === 'NORMAL') return 'neutral';
  return 'neutral';
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

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

  const tStatus = useTranslations('statuses');
  const statusLabel = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={4} />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <ErrorBoard title={t('workerHome.errorTitle')} description={t('workerHome.errorBody')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }

  const data = query.data;
  const open = allOpen(data);
  const current = currentTask(data);
  const upcoming = open.filter((t) => t.id !== current?.id);
  const inProgress = open.filter((t) => String(t.status).toUpperCase() === 'IN_PROGRESS').length;
  const remaining = Math.max(0, open.length - inProgress);
  const empty = data.completedTodayCount === 0 && open.length === 0;
  const name = me.data?.name ?? t('workerHome.fallbackName');
  const taskName = (task: WorkerHomeTask) => localizedName(locale, { nameEn: task.nameEn, nameAr: task.nameAr, nameHe: task.nameHe, name: task.name }, task.name);
  const productName = (task: WorkerHomeTask) => localizedName(locale, { nameEn: task.productNameEn, nameAr: task.productNameAr, nameHe: task.productNameHe, name: task.productTitle }, task.productTitle);
  const total = data.completedTodayCount + open.length;

  return (
    <div className="maher-stagger space-y-5">
      <Board variant="ink" tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t(`workerHome.greeting.${greetingKey()}`, { name })}</h1>
            <p className="mt-1 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tCommon('employeeDashboardSubtitle')}</p>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                { key: 'done', label: t('workerHome.progressDone'), value: data.completedTodayCount, tone: 'success' },
                { key: 'progress', label: t('workerHome.progressInProgress'), value: inProgress, tone: 'brand' },
                { key: 'remaining', label: t('workerHome.progressRemaining'), value: remaining, tone: 'neutral' },
              ]}
            />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={data.completedTodayCount} label={t('workerHome.progressDone')} tone="success" />
              <Figure size="sm" value={inProgress} label={t('workerHome.progressInProgress')} tone="brand" />
              <Figure size="sm" value={remaining} label={t('workerHome.progressRemaining')} />
            </div>
          </div>
        </div>
      </Board>

      {empty ? (
        <Board tone="success">
          <Board.Empty title={t('workerHome.emptyTitle')} description={t('workerHome.emptyBody')} />
        </Board>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        {current ? (
          <Board tone={statusTone(current.status)} wash="top" interactive href={`/worker/tasks/${current.id}`} LinkComponent={Link} className="self-start xl:col-span-7">
            <Board.Header
              title={t('workerHome.currentTask')}
              meta={
                <span className="flex items-center gap-1.5">
                  {current.priority && priorityTone(current.priority) === 'error' ? <Stamp tone="error" size="sm">{current.priority.toLowerCase()}</Stamp> : null}
                  <Stamp tone={statusTone(current.status)} size="sm">{statusLabel(current.status)}</Stamp>
                </span>
              }
            />
            <div className="flex gap-4 px-5 pb-5 sm:px-6">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-28 sm:w-28">
                {mediaSrc(current.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(current.imageUrl) ?? ''} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Armchair className="h-8 w-8 text-[var(--maher-text-tertiary)] opacity-60" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-semibold leading-7 text-[var(--maher-text-primary)]">{taskName(current)}</p>
                <p className="mt-1 text-[14px] text-[var(--maher-text-secondary)]">{productName(current)}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--maher-text-tertiary)]">
                  <Ltr>{current.orderNumber}</Ltr>
                  {current.estimatedMinutes ? <Ltr>{`${current.estimatedMinutes} min`}</Ltr> : null}
                  {current.deadline ? <Ltr>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(current.deadline))}</Ltr> : null}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--maher-brand)]">
                  {tNav('tasks')}
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </span>
              </div>
            </div>
          </Board>
        ) : null}

        <Board tone="neutral" className={current ? 'xl:col-span-5' : 'xl:col-span-12'}>
          <Board.Header title={t('workerHome.upcomingTasks')} meta={<Stamp tone={upcoming.length ? 'info' : 'neutral'} size="sm">{upcoming.length}</Stamp>} actions={<Link href="/worker/tasks" className="text-[13px] font-medium text-[var(--maher-brand)] hover:underline">{tNav('tasks')}</Link>} />
          {upcoming.length === 0 ? (
            <Board.Empty title={t('workerHome.emptyTitle')} />
          ) : (
            <ListRows>
              {upcoming.slice(0, 8).map((task) => (
                <ListRow
                  key={task.id}
                  leading={<RowThumb src={mediaSrc(task.imageUrl)} icon={<Armchair className="h-4 w-4" />} />}
                  title={taskName(task)}
                  meta={<span className="flex items-center gap-2"><span className="truncate">{productName(task)}</span><Ltr className="text-[var(--maher-text-tertiary)]">{task.orderNumber}</Ltr></span>}
                  trailing={<Stamp tone={statusTone(task.status)} size="sm">{statusLabel(task.status)}</Stamp>}
                  href={`/worker/tasks/${task.id}`}
                  LinkComponent={Link}
                />
              ))}
            </ListRows>
          )}
        </Board>
      </div>

      <Board tone="success" interactive href="/worker/tasks/completed" LinkComponent={Link}>
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--maher-success-soft)] text-[var(--maher-success)]">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[14px] font-semibold text-[var(--maher-text-primary)]">{t('workerHome.seeCompleted')}</span>
              <span className="block text-[12px] text-[var(--maher-text-tertiary)]">{`${data.completedTodayCount}/${total}`}</span>
            </span>
          </span>
          <Button size="sm" variant="ghost" trailingIcon={<ArrowRight className="h-4 w-4 rtl:-scale-x-100" />}>
            {tCommon('open')}
          </Button>
        </div>
      </Board>
    </div>
  );
}
