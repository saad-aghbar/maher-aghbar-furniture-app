'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { isDeliveryFloorWorker } from '@/lib/is-delivery-floor-worker';
import type { AuthUser } from '@maher/types';
import { Board, BoardSkeleton, ErrorBoard, Figure, ListRow, ListRows, ListToolbar, Ltr, Ribbon, RowThumb, Stamp, StatusChips, type BoardTone } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Armchair, Truck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type WorkerMyOrder = {
  id: string;
  number: string;
  salesOrderId?: string | null;
  salesOrderNumber: string | null;
  productDescription: string | null;
  productImageUrl: string | null;
  status: string;
  quantity?: string | number | null;
  product?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
};

type WorkerMySalesOrder = {
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  deadline: string | null;
  myTaskCount: number;
  items: WorkerMyOrder[];
};

type DeliveryRow = { id: string; number: string; status: string; deliveryAddress?: string | null; deliveryDate?: string | null };

type Segment = 'open' | 'today' | 'active';

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function statusTone(status: string): BoardTone {
  const key = status.toUpperCase();
  if (key === 'IN_PROGRESS' || key === 'OUT_FOR_DELIVERY') return 'brand';
  if (key === 'COMPLETED' || key === 'DELIVERED') return 'success';
  if (key === 'PAUSED' || key === 'BLOCKED' || key === 'ON_HOLD') return 'warning';
  if (key === 'READY' || key === 'PLANNED') return 'info';
  return 'neutral';
}

export default function TasksPage() {
  const locale = useLocale();
  const t = useTranslations('production');
  const tm = useTranslations('mobile.tasks');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const kit = useKitCopy();
  const [segment, setSegment] = useState<Segment>('open');
  const [q, setQ] = useState('');

  const me = useQuery({ queryKey: ['auth-me'], queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me') });
  const delivery = isDeliveryFloorWorker(me.data);
  const ordersQuery = useQuery({
    queryKey: ['my-orders', segment, q.trim()],
    enabled: Boolean(me.data) && !delivery,
    placeholderData: keepPreviousData,
    queryFn: () => apiFetch<{ data?: WorkerMySalesOrder[]; orders?: WorkerMySalesOrder[] }>(`/api/v1/tasks/my-orders?segment=${segment}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`).then((r) => r.data ?? r.orders ?? []),
  });
  const deliveriesQuery = useQuery({
    queryKey: ['my-deliveries'],
    enabled: Boolean(me.data) && delivery,
    queryFn: () => apiFetch<{ data: DeliveryRow[] }>('/api/v1/deliveries?mine=true&pageSize=50').then((r) => r.data ?? []),
  });

  const groups = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const counts = useMemo(() => {
    const c = { active: 0, ready: 0, paused: 0, other: 0 };
    for (const item of flat) {
      const k = item.status.toUpperCase();
      if (k === 'IN_PROGRESS') c.active += 1;
      else if (k === 'READY' || k === 'PENDING' || k === 'ASSIGNED') c.ready += 1;
      else if (k === 'PAUSED' || k === 'BLOCKED' || k === 'ON_HOLD') c.paused += 1;
      else c.other += 1;
    }
    return c;
  }, [flat]);
  const statusLabel = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  if (me.isLoading || (!delivery && ordersQuery.isLoading && !ordersQuery.data) || (delivery && deliveriesQuery.isLoading && !deliveriesQuery.data)) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }

  if (delivery) {
    if (deliveriesQuery.isError) return <ErrorBoard title={tNav('deliveries')} description={tCommon('loadFailed')} onRetry={() => deliveriesQuery.refetch()} retryLabel={tCommon('retry')} />;
    const rows = deliveriesQuery.data ?? [];
    const live = rows.filter((r) => !['DELIVERED', 'CANCELLED'].includes(r.status.toUpperCase()));
    return (
      <div className="maher-stagger space-y-5">
        <Board variant="ink" tone="brand" wash="top" as="section">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tNav('deliveries')}</h1>
              <p className="mt-1 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tCommon('employeeTasksSubtitle')}</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <Figure size="sm" value={live.length} label={tCommon('open')} tone="brand" />
              <Figure size="sm" value={rows.length - live.length} label={statusLabel('DELIVERED')} tone="success" />
            </div>
          </div>
        </Board>
        <Board tone="neutral">
          <Board.Header title={tNav('deliveries')} meta={<Stamp tone="brand" size="sm">{rows.length}</Stamp>} />
          {rows.length === 0 ? (
            <Board.Empty title={t('empty')} description={tCommon('employeeTasksEmptyHint')} />
          ) : (
            <ListRows>
              {rows.map((row) => (
                <ListRow
                  key={row.id}
                  leading={<RowThumb icon={<Truck className="h-4 w-4" />} />}
                  title={<Ltr>{row.number}</Ltr>}
                  meta={<span className="flex flex-wrap gap-x-2">{row.deliveryAddress ? <span className="truncate">{row.deliveryAddress}</span> : null}{row.deliveryDate ? <Ltr>{dateFmt.format(new Date(row.deliveryDate))}</Ltr> : null}</span>}
                  trailing={<Stamp tone={statusTone(row.status)} size="sm">{statusLabel(row.status)}</Stamp>}
                  href={`/worker/deliveries/${row.id}`}
                  LinkComponent={Link}
                />
              ))}
            </ListRows>
          )}
        </Board>
      </div>
    );
  }

  if (ordersQuery.isError && !ordersQuery.data) {
    return <ErrorBoard title={t('todayTasks')} description={tCommon('loadFailed')} onRetry={() => ordersQuery.refetch()} retryLabel={tCommon('retry')} />;
  }

  return (
    <div className="maher-stagger space-y-5">
      <Board variant="ink" tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{tm('floorEyebrow')}</p>
            <h1 className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('todayTasks')}</h1>
            <p className="mt-1 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{segment === 'today' ? tm('subtitleToday') : segment === 'active' ? tm('subtitleActive') : tm('subtitleOpen')}</p>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={(
                [
                  { key: 'active', label: statusLabel('IN_PROGRESS'), value: counts.active, tone: 'brand' as const },
                  { key: 'ready', label: statusLabel('READY'), value: counts.ready, tone: 'info' as const },
                  { key: 'paused', label: statusLabel('PAUSED'), value: counts.paused, tone: 'warning' as const },
                  { key: 'other', label: tCommon('other'), value: counts.other, tone: 'neutral' as const },
                ] as const
              ).filter((s) => s.value > 0 || s.key !== 'other')}
            />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={flat.length} label={t('tasks')} />
              <Figure size="sm" value={groups.length} label={tm('cardOrder')} tone="info" />
              <Figure size="sm" value={counts.active} label={statusLabel('IN_PROGRESS')} tone="brand" />
            </div>
          </div>
        </div>
      </Board>

      <ListToolbar copy={kit.toolbar} search={{ value: q, onChange: setQ, placeholder: tm('searchPlaceholder') }} />

      <StatusChips
        aria-label={t('todayTasks')}
        value={segment}
        onChange={(id) => setSegment(id as Segment)}
        items={[
          { id: 'open', label: tm('segments.open') },
          { id: 'today', label: tm('segments.today'), tone: 'warning' },
          { id: 'active', label: tm('segments.active'), tone: 'brand' },
        ]}
      />

      {groups.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={t('empty')} description={tCommon('employeeTasksEmptyHint')} />
        </Board>
      ) : (
        <ul className={`maher-stagger grid gap-4 lg:grid-cols-2 ${ordersQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}`}>
          {groups.map((group) => {
            const href = group.salesOrderId ? `/worker/orders/${group.salesOrderId}` : group.items[0] ? `/worker/lane/${group.items[0].id}` : '/worker/tasks';
            const active = group.items.filter((i) => i.status.toUpperCase() === 'IN_PROGRESS').length;
            const tone: BoardTone = active ? 'brand' : group.deadline && new Date(group.deadline).getTime() < Date.now() ? 'error' : 'neutral';
            return (
              <Board key={group.salesOrderId ?? group.items[0]?.id ?? 'g'} as="li" tone={tone} interactive href={href} LinkComponent={Link}>
                <Board.Header
                  title={<Ltr>{group.salesOrderNumber ?? group.items[0]?.number ?? '—'}</Ltr>}
                  description={group.deadline ? tm('deadline', { when: dateFmt.format(new Date(group.deadline)) }) : tm('noDeadline')}
                  meta={
                    <span className="flex items-center gap-1.5">
                      {active ? <Stamp tone="brand" size="sm">{active}</Stamp> : null}
                      <Stamp tone="neutral" size="sm">{group.myTaskCount}</Stamp>
                    </span>
                  }
                />
                <ListRows className="pb-2">
                  {group.items.slice(0, 4).map((item) => (
                    <ListRow
                      key={item.id}
                      leading={<RowThumb src={mediaSrc(item.productImageUrl)} icon={<Armchair className="h-4 w-4" />} />}
                      title={item.product ? localizedName(locale, item.product, item.productDescription ?? item.number) : item.productDescription ?? item.number}
                      meta={<Ltr>{item.number}{item.quantity ? ` · ×${item.quantity}` : ''}</Ltr>}
                      trailing={<Stamp tone={statusTone(item.status)} size="sm">{statusLabel(item.status)}</Stamp>}
                      chevron={false}
                    />
                  ))}
                  {group.items.length > 4 ? <p className="px-5 pt-2 text-[12px] text-[var(--maher-text-tertiary)]">+{group.items.length - 4}</p> : null}
                </ListRows>
              </Board>
            );
          })}
        </ul>
      )}
    </div>
  );
}
