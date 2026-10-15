'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import {
  findWorkerSalesOrder,
  parseWorkerOrderSegment,
  workerOrderSegmentOrder,
  type WorkerOrderSegment,
} from '@/lib/worker-order-lookup';
import { Board, BoardSkeleton, Button, DetailHero, ErrorBoard, ListRow, ListRows, Ltr, Ribbon, RowThumb, Stamp, type BoardTone } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQueries } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type Item = {
  id: string;
  number: string;
  productDescription: string | null;
  productImageUrl: string | null;
  status: string;
  quantity?: string | number | null;
  assignedToMe?: boolean;
  myTaskCount?: number;
  actionableCount?: number;
  blockedCount?: number;
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

function loadOrders(segment: WorkerOrderSegment, q: string) {
  const qs = new URLSearchParams({ segment });
  if (q) qs.set('q', q);
  return apiFetch<{ data?: Group[]; orders?: Group[] }>(`/api/v1/tasks/my-orders?${qs}`).then((json) => json.data ?? json.orders ?? []);
}

export default function WorkerSalesOrderPage({ params }: { params: { salesOrderId: string } }) {
  return (
    <Suspense fallback={<BoardSkeleton rows={5} />}>
      <WorkerSalesOrderDesk params={params} />
    </Suspense>
  );
}

function WorkerSalesOrderDesk({ params }: { params: { salesOrderId: string } }) {
  const locale = useLocale();
  const t = useTranslations('production');
  const tm = useTranslations('mobile.tasks');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferred = parseWorkerOrderSegment(searchParams.get('segment'));
  const q = searchParams.get('q')?.trim() ?? '';
  const specs = [
    { segment: preferred, q },
    ...(q ? [{ segment: preferred, q: '' }] : []),
    ...workerOrderSegmentOrder(preferred)
      .filter((segment) => segment !== preferred)
      .map((segment) => ({ segment, q: '' })),
  ];
  const queries = useQueries({
    queries: specs.map((spec) => ({
      queryKey: ['my-orders', spec.segment, spec.q],
      queryFn: () => loadOrders(spec.segment, spec.q),
    })),
  });

  let found: { group: Group; segment: WorkerOrderSegment } | null = null;
  let waiting = false;
  let failed = false;
  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i]!;
    const query = queries[i];
    const group = findWorkerSalesOrder(query?.data, params.salesOrderId);
    if (group) {
      found = { group, segment: spec.segment };
      break;
    }
    if (query?.isPending) {
      waiting = true;
      break;
    }
    if (query?.isError && !query.data) failed = true;
  }

  if (waiting || queries.some((query) => query.isPending && !found)) {
    if (!found) {
      return (
        <div className="space-y-5">
          <BoardSkeleton rows={3} />
          <BoardSkeleton rows={5} />
        </div>
      );
    }
  }
  if (!found && failed) return <ErrorBoard title={t('todayTasks')} description={tCommon('loadFailed')} onRetry={() => queries.forEach((query) => void query.refetch())} retryLabel={tCommon('retry')} />;

  const group = found?.group ?? null;
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
  const scopeLabel =
    !found || found.segment === preferred
      ? null
      : found.segment === 'today'
        ? tm('segments.today')
        : found.segment === 'active'
          ? tm('segments.active')
          : tm('segments.open');

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        tone={counts.active ? 'brand' : 'neutral'}
        back={{ label: tNav('tasks'), onClick: () => router.push('/worker/tasks') }}
        code={group?.salesOrderNumber ?? params.salesOrderId}
        title={tm('orderContext')}
        subtitle={group?.deadline ? tm('deadline', { when: dateFmt.format(new Date(group.deadline)) }) : tm('noDeadline')}
        status={{ label: items.length ? `${counts.done}/${items.length}` : tm('segments.open'), tone: counts.done === items.length && items.length ? 'success' : 'brand' }}
        facts={[
          { label: t('tasks'), value: `${items.length}`, ltr: true },
          { label: label('IN_PROGRESS'), value: `${counts.active}`, ltr: true, tone: counts.active ? 'brand' : undefined },
          { label: label('COMPLETED'), value: `${counts.done}`, ltr: true, tone: 'success' },
        ]}
      >
        <Ribbon size="sm" segments={[{ key: 'done', label: label('COMPLETED'), value: counts.done, tone: 'success' }, { key: 'active', label: label('IN_PROGRESS'), value: counts.active, tone: 'brand' }, { key: 'rest', label: label('READY'), value: Math.max(0, items.length - counts.done - counts.active), tone: 'neutral' }]} />
      </DetailHero>

      <Board tone="neutral">
        <Board.Header
          title={tm('orderContext')}
          meta={
            <span className="flex items-center gap-1.5">
              {scopeLabel ? <Stamp tone="info" size="sm">{scopeLabel}</Stamp> : null}
              <Stamp tone="neutral" size="sm">{items.length}</Stamp>
            </span>
          }
        />
        {!items.length ? (
          <Board.Empty
            title={tm('orderOutsideOpenTitle')}
            description={tm('orderOutsideOpenBody')}
            action={
              <Button variant="secondary" onClick={() => router.push(`/worker/completed-orders/${params.salesOrderId}`)}>
                {tm('finishedWork')}
              </Button>
            }
          />
        ) : (
          <ListRows>
            {items.map((item) => {
              const waiting = item.assignedToMe !== false && (item.myTaskCount ?? 0) > 0 && (item.actionableCount ?? 0) === 0;
              const blocked = waiting && (item.blockedCount ?? 0) > 0;
              const stamp = item.assignedToMe === false
                ? tm('viewOnly')
                : blocked
                  ? tm('orderCardBlocked', { count: item.blockedCount ?? 0 })
                  : waiting
                    ? tm('lockLocked')
                    : label(item.status);
              return (
                <ListRow
                  key={item.id}
                  leading={<RowThumb src={media(item.productImageUrl)} icon={<Armchair className="h-4 w-4" />} />}
                  title={item.product ? localizedName(locale, item.product, item.productDescription ?? item.number) : item.productDescription ?? item.number}
                  meta={<Ltr>{item.number}{item.quantity ? ` · × ${item.quantity}` : ''}</Ltr>}
                  trailing={<Stamp tone={item.assignedToMe === false ? 'neutral' : waiting ? 'warning' : tone(item.status)} size="sm">{stamp}</Stamp>}
                  href={`/worker/lane/${item.id}`}
                  LinkComponent={Link}
                />
              );
            })}
          </ListRows>
        )}
      </Board>
    </div>
  );
}
