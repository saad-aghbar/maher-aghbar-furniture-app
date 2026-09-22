'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { Board, BoardSkeleton, DetailHero, ErrorBoard, ListRow, ListRows, Ltr, Ribbon, RowThumb, Stamp, type BoardTone } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type Item = {
  id: string;
  number: string;
  productDescription: string | null;
  productImageUrl: string | null;
  status: string;
  quantity?: string | number | null;
  product?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
};

type Group = { salesOrderId: string | null; salesOrderNumber: string | null; deadline?: string | null; myTaskCount?: number; items: Item[] };

function tone(status: string): BoardTone {
  const key = status.toUpperCase();
  if (key === 'COMPLETED') return 'success';
  if (key === 'IN_PROGRESS') return 'brand';
  if (key === 'PAUSED' || key === 'BLOCKED') return 'warning';
  if (key === 'READY') return 'info';
  return 'neutral';
}

export default function WorkerSalesOrderPage({ params }: { params: { salesOrderId: string } }) {
  const locale = useLocale();
  const t = useTranslations('production');
  const tm = useTranslations('mobile.tasks');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const router = useRouter();
  const query = useQuery({ queryKey: ['my-orders', 'open'], queryFn: () => apiFetch<{ data?: Group[]; orders?: Group[] }>('/api/v1/tasks/my-orders?segment=open').then((r) => r.data ?? r.orders ?? []) });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }
  if (query.isError) return <ErrorBoard title={t('todayTasks')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  const group = (query.data ?? []).find((g) => g.salesOrderId === params.salesOrderId);
  const items = group?.items ?? [];
  const label = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const media = (url: string | null) => (url ? (/^https?:\/\//i.test(url) ? url : `${API_URL}${url}`) : null);
  const counts = { active: items.filter((i) => i.status.toUpperCase() === 'IN_PROGRESS').length, done: items.filter((i) => i.status.toUpperCase() === 'COMPLETED').length };
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        tone={counts.active ? 'brand' : 'neutral'}
        back={{ label: tNav('tasks'), onClick: () => router.push('/worker/tasks') }}
        code={group?.salesOrderNumber ?? params.salesOrderId}
        title={tm('orderContext')}
        subtitle={group?.deadline ? tm('deadline', { when: dateFmt.format(new Date(group.deadline)) }) : tm('noDeadline')}
        status={{ label: `${counts.done}/${items.length}`, tone: counts.done === items.length && items.length ? 'success' : 'brand' }}
        facts={[
          { label: t('tasks'), value: `${items.length}`, ltr: true },
          { label: label('IN_PROGRESS'), value: `${counts.active}`, ltr: true, tone: counts.active ? 'brand' : undefined },
          { label: label('COMPLETED'), value: `${counts.done}`, ltr: true, tone: 'success' },
        ]}
      >
        <Ribbon size="sm" segments={[{ key: 'done', label: label('COMPLETED'), value: counts.done, tone: 'success' }, { key: 'active', label: label('IN_PROGRESS'), value: counts.active, tone: 'brand' }, { key: 'rest', label: label('READY'), value: Math.max(0, items.length - counts.done - counts.active), tone: 'neutral' }]} />
      </DetailHero>

      <Board tone="neutral">
        <Board.Header title={tm('orderContext')} meta={<Stamp tone="neutral" size="sm">{items.length}</Stamp>} />
        {!items.length ? (
          <Board.Empty title={t('empty')} />
        ) : (
          <ListRows>
            {items.map((item) => (
              <ListRow
                key={item.id}
                leading={<RowThumb src={media(item.productImageUrl)} icon={<Armchair className="h-4 w-4" />} />}
                title={item.product ? localizedName(locale, item.product, item.productDescription ?? item.number) : item.productDescription ?? item.number}
                meta={<Ltr>{item.number}{item.quantity ? ` · × ${item.quantity}` : ''}</Ltr>}
                trailing={<Stamp tone={tone(item.status)} size="sm">{label(item.status)}</Stamp>}
                href={`/worker/lane/${item.id}`}
                LinkComponent={Link}
              />
            ))}
          </ListRows>
        )}
      </Board>
    </div>
  );
}
