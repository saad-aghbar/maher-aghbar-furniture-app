'use client';

import {
  JOURNEY_BUCKETS,
  daysUntil,
  journeyTone,
  requestTone,
  salesOrderTone,
  useOrdersCopy,
  type JourneyBucket,
  type SalesOrderRow,
} from '@/components/orders/orders-shared';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import type { Paginated } from '@/lib/paginated';
import { localizedName } from '@maher/i18n';
import {
  Board,
  BoardSkeleton,
  ErrorBoard,
  Figure,
  ListRow,
  ListRows,
  Ltr,
  Ribbon,
  RowThumb,
  Stamp,
  Ticket,
  type BoardTone,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

interface RequestRow {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  submittedAt?: string | null;
  projectName?: string | null;
  informationRequestReason?: string | null;
  customer?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null } | null;
}

interface QuotationRow {
  id: string;
  number: string;
  status: string;
  expirationDate?: string | null;
  total?: string | number | null;
  customer?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null } | null;
}

interface ReturnedCase {
  id: string;
  number: string;
  lifecycleState: string;
  productDescription?: string | null;
  createdAt: string;
  customer?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null } | null;
  originalOrder?: { id: string; number: string } | null;
}

type Decision = { id: string; tone: BoardTone; title: string; why: string; href: string; action: string; priority: number };

export default function OrdersOverviewPage() {
  const copy = useOrdersCopy();
  const t = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');

  const orders = useQuery({
    queryKey: ['orders-desk', 'sales-orders'],
    queryFn: () => apiFetch<Paginated<SalesOrderRow> & { meta: { journeyCounts?: Partial<Record<JourneyBucket | 'all', number>> } }>('/api/v1/sales-orders?pageSize=40&statusGroup=production&sortBy=requiredDeliveryDate&sortDir=asc'),
  });
  const recentOrders = useQuery({
    queryKey: ['orders-desk', 'recent'],
    queryFn: () => apiFetch<Paginated<SalesOrderRow>>('/api/v1/sales-orders?pageSize=8&sortBy=createdAt&sortDir=desc'),
  });
  const requests = useQuery({
    queryKey: ['orders-desk', 'requests'],
    queryFn: () => apiFetch<Paginated<RequestRow> & { meta: { inboxCounts?: { all: number; waiting: number; needs_info: number; quoted: number; drafts: number } } }>('/api/v1/requests?pageSize=40&statusGroup=open_inbox'),
  });
  const quotations = useQuery({
    queryKey: ['orders-desk', 'quotations'],
    queryFn: async () => {
      const [review, sent] = await Promise.all([
        apiFetch<Paginated<QuotationRow>>('/api/v1/quotations?pageSize=20&status=INTERNAL_REVIEW'),
        apiFetch<Paginated<QuotationRow>>('/api/v1/quotations?pageSize=40&status=SENT'),
      ]);
      return { review, sent };
    },
  });
  const returned = useQuery({
    queryKey: ['orders-desk', 'returned-cases'],
    queryFn: () => apiFetch<Paginated<ReturnedCase>>('/api/v1/sales-orders/returned-cases?pageSize=10'),
    retry: false,
  });

  const counts = orders.data?.meta.journeyCounts ?? {};
  const inbox = requests.data?.meta.inboxCounts;
  const activeCount = (counts.ready_to_start ?? 0) + (counts.in_production ?? 0) + (counts.preparing ?? 0);

  const lateOrders = useMemo(
    () => (orders.data?.data ?? []).filter((o) => (daysUntil(o.journeyLogistics?.committedDeliveryDate ?? o.requiredDeliveryDate) ?? 1) < 0),
    [orders.data],
  );

  const decisions = useMemo<Decision[]>(() => {
    const list: Decision[] = [];
    lateOrders.slice(0, 4).forEach((o) => {
      const days = Math.abs(daysUntil(o.journeyLogistics?.committedDeliveryDate ?? o.requiredDeliveryDate) ?? 0);
      list.push({
        id: `late-${o.id}`,
        tone: 'error',
        title: `${o.number} · ${o.customer ? localizedName(copy.locale, o.customer, o.customer.name ?? '') : ''}`,
        why: tSales('desk.lateWhy', { count: days, stage: o.journeyBucket ? copy.journey(o.journeyBucket) : copy.status(o.status) }),
        href: `/admin/sales-orders/${o.id}`,
        action: tCommon('details'),
        priority: 0,
      });
    });
    (requests.data?.data ?? [])
      .filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW')
      .map((r) => ({ r, days: Math.abs(daysUntil(r.submittedAt ?? r.createdAt) ?? 0) }))
      .filter(({ days }) => days >= 3)
      .sort((a, b) => b.days - a.days)
      .slice(0, 3)
      .forEach(({ r, days }) =>
        list.push({
          id: `rfq-${r.id}`,
          tone: 'warning',
          title: `${r.number} · ${r.customer ? localizedName(copy.locale, r.customer) : ''}`,
          why: tSales('desk.rfqWaitingWhy', { count: days }),
          href: `/admin/requests/${r.id}`,
          action: tc('viewDetails'),
          priority: 1,
        }),
      );
    (quotations.data?.review.data ?? []).slice(0, 3).forEach((q) =>
      list.push({
        id: `qr-${q.id}`,
        tone: 'warning',
        title: `${q.number} · ${q.customer ? localizedName(copy.locale, q.customer, q.customer.name) : ''}`,
        why: tSales('desk.quoteReviewWhy'),
        href: `/admin/quotations/${q.id}`,
        action: tSales('desk.review'),
        priority: 1,
      }),
    );
    (quotations.data?.sent.data ?? [])
      .map((q) => ({ q, days: daysUntil(q.expirationDate) }))
      .filter(({ days }) => days != null && days <= 3)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
      .slice(0, 3)
      .forEach(({ q, days }) =>
        list.push({
          id: `qe-${q.id}`,
          tone: (days ?? 0) < 0 ? 'error' : 'warning',
          title: `${q.number} · ${q.customer ? localizedName(copy.locale, q.customer, q.customer.name) : ''}`,
          why: (days ?? 0) < 0 ? tSales('desk.expiredDays', { count: Math.abs(days ?? 0) }) : tSales('desk.expiresIn', { count: days ?? 0 }),
          href: `/admin/quotations/${q.id}`,
          action: tCommon('details'),
          priority: 2,
        }),
      );
    (returned.data?.data ?? []).slice(0, 3).forEach((rc) =>
      list.push({
        id: `ret-${rc.id}`,
        tone: 'warning',
        title: `${rc.number} · ${rc.customer ? localizedName(copy.locale, rc.customer, rc.customer.name) : ''}`,
        why: tSales('desk.returnedCaseWhy', { order: rc.originalOrder?.number ?? '—' }),
        href: `/admin/returns/${rc.id}`,
        action: tCommon('details'),
        priority: 2,
      }),
    );
    return list.sort((a, b) => a.priority - b.priority).slice(0, 8);
  }, [lateOrders, requests.data, quotations.data, returned.data, copy, tSales, tCommon, tc]);

  const loading = orders.isLoading || requests.isLoading;
  const error = orders.isError && requests.isError;

  if (error) {
    return (
      <ErrorBoard
        title={tCommon('loadFailed')}
        onRetry={() => {
          void orders.refetch();
          void requests.refetch();
        }}
      />
    );
  }

  const figures: Array<{ key: string; label: string; value: number; tone?: BoardTone; href: string }> = [
    { key: 'rfq', label: copy.tm('rfqInbox.waiting'), value: inbox?.waiting ?? 0, tone: inbox?.waiting ? 'info' : 'neutral', href: '/admin/requests?group=waiting_review' },
    { key: 'needs', label: copy.tm('rfqInbox.needs_info'), value: inbox?.needs_info ?? 0, tone: inbox?.needs_info ? 'warning' : 'neutral', href: '/admin/requests?group=needs_information' },
    { key: 'review', label: copy.status('INTERNAL_REVIEW'), value: quotations.data?.review.meta.totalItems ?? 0, tone: quotations.data?.review.meta.totalItems ? 'warning' : 'neutral', href: '/admin/quotations?status=INTERNAL_REVIEW' },
    { key: 'active', label: tSales('desk.activeOrders'), value: activeCount, tone: activeCount ? undefined : 'neutral', href: '/admin/sales-orders' },
    { key: 'ship', label: copy.journey('ready_to_ship'), value: counts.ready_to_ship ?? 0, tone: counts.ready_to_ship ? 'warning' : 'neutral', href: '/admin/sales-orders?bucket=ready_to_ship' },
    { key: 'late', label: tSales('desk.late'), value: lateOrders.length, tone: lateOrders.length ? 'error' : 'neutral', href: '/admin/sales-orders?delivery=overdue' },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={lateOrders.length ? 'error' : 'brand'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('ordersOverview')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tSales('desk.overviewHint')}</p>
            {activeCount + (counts.ready_to_ship ?? 0) + (counts.shipped ?? 0) > 0 ? (
              <div className="mt-4">
                <Ribbon
                  size="sm"
                  segments={JOURNEY_BUCKETS.filter((b) => b !== 'delivered').map((b) => ({ key: b, label: copy.journey(b), value: counts[b] ?? 0, tone: journeyTone(b) }))}
                />
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-6 lg:grid-cols-3">
            {figures.map((f) => (
              <Link key={f.key} href={f.href} className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
                <Figure size="sm" value={f.value} label={f.label} tone={f.tone} />
              </Link>
            ))}
          </div>
        </div>
      </Board>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
          {/* Decisions */}
          {loading ? (
            <BoardSkeleton rows={4} />
          ) : (
            <Board tone={decisions.some((d) => d.tone === 'error') ? 'error' : decisions.length ? 'warning' : 'success'} wash={decisions.length ? 'top' : 'none'}>
              <Board.Header
                title={tSales('desk.decisionsTitle')}
                description={tSales('desk.decisionsHint')}
                meta={decisions.length ? <Stamp tone={decisions.some((d) => d.tone === 'error') ? 'error' : 'warning'} size="sm">{decisions.length}</Stamp> : null}
              />
              {decisions.length ? (
                <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
                  {decisions.map((d) => (
                    <li key={d.id}>
                      <Ticket tone={d.tone} title={d.title} why={d.why} href={d.href} action={d.action} LinkComponent={Link} wash={d.tone === 'error'} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Board.Empty title={tSales('desk.decisionsEmptyTitle')} description={tSales('desk.decisionsEmptyBody')} />
              )}
            </Board>
          )}

          {/* Lanes */}
          <Board tone="brand">
            <Board.Header title={tSales('desk.lanesTitle')} description={tSales('desk.lanesHint')} meta={<span className="tabular-nums">{tSales('desk.openOrders', { count: counts.all ?? 0 })}</span>} />
            <Board.Body>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {JOURNEY_BUCKETS.map((b) => (
                  <Link key={b} href={`/admin/sales-orders?bucket=${b}`} className="maher-press flex flex-col gap-1 rounded-[12px] px-2 py-2 transition-colors hover:bg-[var(--maher-surface-muted)]">
                    <span className="flex items-center gap-1.5">
                      <Stamp tone={(counts[b] ?? 0) > 0 ? journeyTone(b) : 'neutral'} />
                      <span className="text-[20px] font-semibold leading-6 tabular-nums text-[var(--maher-text-primary)]">{counts[b] ?? 0}</span>
                    </span>
                    <span className="text-[12px] leading-4 text-[var(--maher-text-secondary)]">{copy.journey(b)}</span>
                  </Link>
                ))}
              </div>
            </Board.Body>
          </Board>

          {/* Customer requests inbox */}
          <Board tone={inbox?.needs_info ? 'warning' : 'info'} className="xl:flex-1">
            <Board.Header
              title={copy.tm('requestsInboxTitle')}
              description={copy.tm('requestsInboxHint')}
              actions={
                <Link href="/admin/requests" className="text-[13px] font-medium text-[var(--maher-brand)] hover:underline">
                  {tCommon('viewAll')}
                </Link>
              }
            />
            <Board.Body padding="none" grow>
              {requests.isLoading ? (
                <div className="p-5">
                  <BoardSkeleton rows={3} header={false} className="border-0 shadow-none" />
                </div>
              ) : requests.data?.data.length ? (
                <ListRows>
                  {requests.data.data.slice(0, 6).map((r) => (
                    <ListRow
                      key={r.id}
                      href={`/admin/requests/${r.id}`}
                      LinkComponent={Link}
                      tone={requestTone(r.status)}
                      title={r.customer ? localizedName(copy.locale, r.customer) : r.number}
                      meta={`${r.number}${r.projectName ? ` · ${r.projectName}` : ''}`}
                      trailing={
                        <Stamp tone={requestTone(r.status)} size="sm">
                          {copy.status(r.status)}
                        </Stamp>
                      }
                    />
                  ))}
                </ListRows>
              ) : (
                <Board.Empty title={copy.tm('requestsEmptyTitle')} description={copy.tm('requestsEmptyBody')} />
              )}
            </Board.Body>
          </Board>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          {/* Due soon */}
          <Board tone={lateOrders.length ? 'error' : 'brand'}>
            <Board.Header title={tSales('desk.dueSoonTitle')} description={tSales('desk.dueSoonHint')} />
            <Board.Body padding="none">
              {orders.isLoading ? (
                <div className="p-5">
                  <BoardSkeleton rows={4} header={false} className="border-0 shadow-none" />
                </div>
              ) : (orders.data?.data.length ?? 0) > 0 ? (
                <ListRows>
                  {(orders.data?.data ?? [])
                    .filter((o) => o.journeyBucket !== 'delivered')
                    .slice(0, 6)
                    .map((o) => {
                      const date = o.journeyLogistics?.committedDeliveryDate ?? o.requiredDeliveryDate;
                      const days = daysUntil(date);
                      return (
                        <ListRow
                          key={o.id}
                          href={`/admin/sales-orders/${o.id}`}
                          LinkComponent={Link}
                          leading={<RowThumb src={o.imageUrl} icon={<Stamp tone={salesOrderTone(o.status)} />} />}
                          title={<Ltr>{o.number}</Ltr>}
                          meta={`${o.customer ? localizedName(copy.locale, o.customer, o.customer.name ?? '') : ''}${o.journeyBucket ? ` · ${copy.journey(o.journeyBucket)}` : ''}`}
                          trailing={
                            <span className="flex flex-col items-end text-[12px]">
                              <span>{copy.date(date)}</span>
                              {days != null ? (
                                <span style={{ color: days < 0 ? 'var(--maher-error)' : days <= 3 ? 'var(--maher-warning)' : 'var(--maher-text-tertiary)' }}>{copy.dueLabel(days)}</span>
                              ) : null}
                            </span>
                          }
                        />
                      );
                    })}
                </ListRows>
              ) : (
                <Board.Empty title={tSales('desk.dueSoonEmptyTitle')} description={tSales('desk.dueSoonEmptyBody')} />
              )}
            </Board.Body>
          </Board>

          {/* Recent */}
          <Board tone="neutral" className="xl:flex-1">
            <Board.Header
              title={tSales('desk.recentTitle')}
              description={tSales('desk.recentHint')}
              actions={
                <Link href="/admin/sales-orders" className="text-[13px] font-medium text-[var(--maher-brand)] hover:underline">
                  {tCommon('viewAll')}
                </Link>
              }
            />
            <Board.Body padding="none" grow>
              {recentOrders.isLoading ? (
                <div className="p-5">
                  <BoardSkeleton rows={4} header={false} className="border-0 shadow-none" />
                </div>
              ) : recentOrders.data?.data.length ? (
                <ListRows>
                  {recentOrders.data.data.map((o) => (
                    <ListRow
                      key={o.id}
                      href={`/admin/sales-orders/${o.id}`}
                      LinkComponent={Link}
                      leading={<RowThumb src={o.imageUrl} icon={<Stamp tone={salesOrderTone(o.status)} />} />}
                      title={<Ltr>{o.number}</Ltr>}
                      meta={`${o.customer ? localizedName(copy.locale, o.customer, o.customer.name ?? '') : ''} · ${copy.date(o.createdAt)}`}
                      trailing={
                        <Stamp tone={salesOrderTone(o.status)} size="sm">
                          {o.journeyBucket ? copy.journey(o.journeyBucket) : copy.status(o.status)}
                        </Stamp>
                      }
                    />
                  ))}
                </ListRows>
              ) : (
                <Board.Empty title={tSales('empty')} description={tSales('emptyHint')} />
              )}
            </Board.Body>
          </Board>
        </div>
      </div>
    </div>
  );
}
