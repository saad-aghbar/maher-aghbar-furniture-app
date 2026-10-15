'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { loadCompletedOrderTasks } from '@/lib/completed-order-tasks';
import { Board, BoardSkeleton, DetailHero, ErrorBoard, ListRow, ListRows, Ltr, Stamp } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type CompletedTask = {
  id: string;
  number: string;
  name: string;
  status: string;
  actualMinutes?: number | null;
  completedAt?: string | null;
  salesOrderId?: string | null;
  productionOrder?: {
    number?: string | null;
    productDescription?: string | null;
    salesOrderId?: string | null;
    salesOrder?: { id?: string; number?: string | null } | null;
  } | null;
  stageDefinition?: { code?: string; nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
};

/** Finished work for one parent. This is not the Open list. */
export default function CompletedSalesOrderPage({ params }: { params: { salesOrderId: string } }) {
  const locale = useLocale();
  const t = useTranslations('production');
  const tm = useTranslations('mobile.tasks');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const query = useQuery({
    queryKey: ['my-tasks-completed', params.salesOrderId],
    queryFn: () => loadCompletedOrderTasks<CompletedTask>(params.salesOrderId),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (query.isError) return <ErrorBoard title={tm('finishedWork')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;

  const tasks = (query.data ?? []).filter((task) => task.stageDefinition?.code !== 'DELIVERY');
  const orderNumber = tasks[0]?.productionOrder?.salesOrder?.number ?? tasks[0]?.productionOrder?.number ?? params.salesOrderId;
  const minutes = tasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        tone="success"
        back={{ label: tNav('tasks'), onClick: () => router.push('/worker/tasks/completed') }}
        code={orderNumber}
        title={tm('finishedWork')}
        subtitle={tm('orderContext')}
        facts={[
          { label: t('tasks'), value: String(tasks.length), ltr: true, tone: 'success' },
          { label: tCommon('total'), value: minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : '—', ltr: true },
        ]}
      />
      <Board tone={tasks.length ? 'success' : 'neutral'}>
        <Board.Header title={tm('finishedWork')} meta={<Stamp tone="success" size="sm">{tasks.length}</Stamp>} />
        {tasks.length === 0 ? (
          <Board.Empty title={tm('orderOutsideOpenTitle')} description={tm('emptyCompletedFilteredBody')} />
        ) : (
          <ListRows>
            {tasks.map((task) => (
              <ListRow
                key={task.id}
                leading={<span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--maher-success-soft)] text-[var(--maher-success)]"><CheckCircle2 className="h-4 w-4" /></span>}
                title={task.stageDefinition ? localizedName(locale, task.stageDefinition, task.name) : task.name}
                meta={<Ltr>{task.productionOrder?.number ?? task.number}</Ltr>}
                trailing={task.actualMinutes ? <Stamp tone="success" size="sm"><Ltr>{`${Math.floor(task.actualMinutes / 60)}h ${task.actualMinutes % 60}m`}</Ltr></Stamp> : null}
                href={`/worker/tasks/${task.id}`}
                LinkComponent={Link}
              />
            ))}
          </ListRows>
        )}
      </Board>
    </div>
  );
}
