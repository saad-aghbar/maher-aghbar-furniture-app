'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { Board, BoardSkeleton, DateRangeField, ErrorBoard, Figure, ListRow, ListRows, ListToolbar, Ltr, Stamp, StatusChips } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Task {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  completedAt?: string | null;
  actualMinutes?: number | null;
  productionOrder?: { number: string; productDescription?: string; customerId?: string | null; customer?: { id: string; name: string; nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null };
  stageDefinition?: { code: string; nameEn: string; nameAr?: string; nameHe?: string | null };
}

interface DealerOption {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
}

export default function CompletedTasksPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tm = useTranslations('mobile.tasks');
  const tProd = useTranslations('production');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const [range, setRange] = useState({ from: '', to: '' });
  const [dealerId, setDealerId] = useState('all');
  const [q, setQ] = useState('');

  const qs = new URLSearchParams({ mine: 'true', scope: 'completed', pageSize: '100' });
  if (range.from) qs.set('completedFrom', range.from);
  if (range.to) qs.set('completedTo', range.to);
  if (dealerId !== 'all') qs.set('customerId', dealerId);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['my-tasks-completed', qs.toString()],
    placeholderData: keepPreviousData,
    queryFn: () => apiFetch<{ data: Task[] }>(`/api/v1/tasks?${qs}`).then((r) => r.data ?? []),
  });
  const dealers = useQuery({ queryKey: ['tasks-completed-dealers'], queryFn: () => apiFetch<{ data: DealerOption[] }>('/api/v1/tasks/completed-dealers').then((r) => r.data ?? []), staleTime: 5 * 60 * 1000 });

  const tasks = useMemo(() => {
    const all = (data ?? []).filter((task) => task.status === 'COMPLETED');
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((task) => `${task.number} ${task.name} ${task.productionOrder?.number ?? ''} ${task.productionOrder?.productDescription ?? ''}`.toLowerCase().includes(needle)) : all;
  }, [data, q]);
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const day = task.completedAt ? task.completedAt.slice(0, 10) : 'unknown';
      map.set(day, [...(map.get(day) ?? []), task]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [tasks]);
  const minutes = tasks.reduce((acc, task) => acc + (task.actualMinutes ?? 0), 0);
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  if (isLoading && !data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }
  if (isError && !data) return <ErrorBoard title={t('completeTask')} description={tCommon('loadFailed')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />;

  return (
    <div className="maher-stagger space-y-5">
      <Board variant="ink" tone="success" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{tm('completedEyebrow')}</p>
            <h1 className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tm('completedTitle')}</h1>
            <p className="mt-1 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tm('completedSubtitle')}</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <Figure size="sm" value={tasks.length} label={tProd('tasks')} tone="success" />
            <Figure size="sm" value={groups.filter(([d]) => d !== 'unknown').length} label={tm('completedDateLabel')} />
            <Figure size="sm" value={minutes ? Math.round(minutes / 60) : 0} unit="h" label={tCommon('total')} tone="brand" />
          </div>
        </div>
      </Board>

      <ListToolbar copy={kit.toolbar} search={{ value: q, onChange: setQ, placeholder: tm('completedSearchPlaceholder') }} actions={<DateRangeField size="sm" from={range.from} to={range.to} onChange={setRange} copy={kit.range} locale={locale} />} />

      {dealers.data?.length ? (
        <StatusChips aria-label={tCommon('filter')} value={dealerId} onChange={setDealerId} items={[{ id: 'all', label: tm('chips.all') }, ...dealers.data.map((d) => ({ id: d.id, label: localizedName(locale, d, d.name) || d.code }))]} />
      ) : null}

      {tasks.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={q || dealerId !== 'all' || range.from ? tm('emptyCompletedFilteredTitle') : tProd('empty')} description={q || dealerId !== 'all' || range.from ? tm('emptyCompletedFilteredBody') : tCommon('employeeTasksEmptyHint')} />
        </Board>
      ) : (
        <div className={`maher-stagger space-y-4 ${isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}`}>
          {groups.map(([day, items]) => (
            <Board key={day} tone="success">
              <Board.Header title={day === 'unknown' ? tm('completedDateAll') : <Ltr>{dayFmt.format(new Date(`${day}T00:00:00`))}</Ltr>} meta={<Stamp tone="success" size="sm">{items.length}</Stamp>} />
              <ListRows>
                {items.map((task) => (
                  <ListRow
                    key={task.id}
                    leading={<span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--maher-success-soft)] text-[var(--maher-success)]"><CheckCircle2 className="h-4 w-4" /></span>}
                    title={task.stageDefinition ? localizedName(locale, task.stageDefinition, task.name) : task.name}
                    meta={
                      <span className="flex flex-wrap items-center gap-x-2">
                        <Ltr>{task.productionOrder?.number ?? task.number}</Ltr>
                        {task.productionOrder?.productDescription ? <span className="truncate">{task.productionOrder.productDescription}</span> : null}
                        {task.productionOrder?.customer ? <span className="text-[var(--maher-text-tertiary)]">{localizedName(locale, task.productionOrder.customer, task.productionOrder.customer.name)}</span> : null}
                      </span>
                    }
                    trailing={
                      <span className="flex items-center gap-3">
                        {task.actualMinutes ? <Stamp tone="success" size="sm"><Ltr>{`${Math.floor(task.actualMinutes / 60)}h ${task.actualMinutes % 60}m`}</Ltr></Stamp> : null}
                        {task.completedAt ? <Ltr className="text-[12px] text-[var(--maher-text-tertiary)]">{timeFmt.format(new Date(task.completedAt))}</Ltr> : null}
                      </span>
                    }
                    href={`/worker/tasks/${task.id}`}
                    LinkComponent={Link}
                  />
                ))}
              </ListRows>
            </Board>
          ))}
        </div>
      )}
    </div>
  );
}
