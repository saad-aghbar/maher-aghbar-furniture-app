'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import type { OwnDeliveriesResponse } from '@/lib/dealer-schedule';
import { asRows } from '@/lib/paginated';
import {
  classifyHubLifecycle,
  countLifecycleTabs,
  deliveryStatusFromCustomerStatus,
  lifecycleEmptyMessageKey,
  matchOrderSearch,
  matchesLifecycleTab,
  ORDER_LIFECYCLE_TABS,
  type OrderLifecycleTab,
} from '@/lib/dealer-order-ui';
import { Board, BoardSkeleton, Button, ErrorBoard, Figure, ListToolbar, Ltr, Meter, Ribbon, Stamp, StatusChips, type BoardTone } from '@maher/ui';
import { useKitCopy } from '@/lib/kit-copy';
import { useQuery } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

interface RequestDoc {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
}

interface RequestRow {
  id: string;
  number: string;
  status: string;
  externalOrderNumber?: string | null;
  endCustomerName?: string | null;
  createdAt?: string;
  title?: string | null;
  imageUrl?: string | null;
  items?: Array<{ productName: string }>;
  documents?: RequestDoc[];
}

interface SalesOrderRow {
  id: string;
  number: string;
  status: string;
  externalOrderNumber?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  progressPercent?: number | null;
  requiredDeliveryDate?: string | null;
  productionOrders?: Array<{
    status?: string;
    currentStageCode?: string | null;
    progressPercent?: number | null;
  }>;
  quotation?: { request?: { externalOrderNumber?: string | null } | null } | null;
}

interface DealerDeliveryRow {
  id?: string;
  salesOrderId: string;
  calendarDate?: string | null;
  customerStatus?: string;
  compactDates?: boolean;
  committedDeliveryDate?: string | null;
}

type HubRow =
  | (RequestRow & { kind: 'rfq' })
  | (SalesOrderRow & { kind: 'sales_order'; deliveryStatus?: string | null });

const TAB_TONE: Record<OrderLifecycleTab, BoardTone> = {
  all: 'neutral',
  draft: 'neutral',
  waiting: 'warning',
  needsInformation: 'error',
  inProduction: 'brand',
  ready: 'success',
  shipped: 'info',
  delivered: 'success',
};

function statusTone(status: string): BoardTone {
  const key = status.toUpperCase();
  if (/(DELIVERED|COMPLETED|ACCEPTED|APPROVED)/.test(key)) return 'success';
  if (/(REJECTED|CANCEL|OVERDUE)/.test(key)) return 'error';
  if (/(NEED|PENDING|WAITING|DRAFT|SUBMITTED)/.test(key)) return 'warning';
  if (/(PRODUCTION|PROGRESS|CONFIRMED|SHIPPED|READY|IN_TRANSIT)/.test(key)) return 'brand';
  return 'neutral';
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function dealerOrderNumber(row: HubRow) {
  if (row.kind === 'rfq') return row.externalOrderNumber?.trim() || null;
  return (
    row.externalOrderNumber?.trim() ||
    row.quotation?.request?.externalOrderNumber?.trim() ||
    null
  );
}

function orderTitle(row: HubRow) {
  if (row.kind === 'sales_order') {
    return row.title?.trim() || row.number;
  }
  return row.title?.trim() || row.items?.[0]?.productName?.trim() || row.number;
}

function firstImageDoc(docs?: RequestDoc[]) {
  if (!docs?.length) return null;
  const preferred = docs.find(
    (d) =>
      d.category === 'MODEL_IMAGE' ||
      d.category === 'ORDER_IMAGE' ||
      d.category === 'HANDWRITTEN_ORDER' ||
      (d.mimeType ?? '').startsWith('image/'),
  );
  if (preferred) return preferred;
  return (
    docs.find((d) => {
      const name = d.fileName.toLowerCase();
      return /\.(png|jpe?g|webp|gif|heic)$/i.test(name);
    }) ?? null
  );
}

function OrderCard({
  row,
  detailHref,
  title,
  imageUrl,
  tSales,
  tLifecycle,
  tStatus,
  delivery,
}: {
  row: HubRow;
  detailHref: string;
  title: string;
  imageUrl: string | null;
  tSales: ReturnType<typeof useTranslations>;
  tLifecycle: ReturnType<typeof useTranslations>;
  tStatus: ReturnType<typeof useTranslations>;
  delivery?: DealerDeliveryRow;
}) {
  const dealerNo = dealerOrderNumber(row);
  const progress = row.kind === 'sales_order' && row.progressPercent != null ? row.progressPercent : null;
  const rawEnd = row.kind === 'rfq' ? row.endCustomerName?.trim() : null;
  const endCustomer = rawEnd && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawEnd) ? rawEnd : null;
  const lifecycle = classifyHubLifecycle(row);
  const tone = lifecycle && lifecycle !== 'pending' ? TAB_TONE[lifecycle as OrderLifecycleTab] ?? statusTone(row.status) : statusTone(row.status);
  const safeStatus = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };

  return (
    <Board as="li" tone={tone} interactive href={detailHref} LinkComponent={Link} className="h-full">
      <div className="relative aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 ease-out group-hover:scale-[1.05]" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[var(--maher-text-tertiary)]">
            <Armchair className="h-7 w-7 opacity-40" />
            <Ltr className="text-[10px] font-medium uppercase tracking-wide">{row.number}</Ltr>
          </div>
        )}
        <span className="absolute start-2 top-2">
          <Stamp tone={tone} size="sm">{lifecycle && lifecycle !== 'pending' ? tLifecycle(`tabs.${lifecycle}`) : safeStatus(row.status)}</Stamp>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
        <Ltr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{row.number}</Ltr>
        <h2 className="line-clamp-2 text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">{title}</h2>
        {dealerNo ? (
          <p className="truncate text-[12px] text-[var(--maher-text-secondary)]">
            {tSales('dealerOrderNumber')}: <Ltr>{dealerNo}</Ltr>
          </p>
        ) : null}
        {endCustomer ? <p className="truncate text-[12px] text-[var(--maher-text-tertiary)]">{endCustomer}</p> : null}
        {progress != null ? <Meter value={progress} max={100} tone={tone} valueLabel={`${Math.round(progress)}%`} /> : null}
        {delivery?.calendarDate || delivery?.customerStatus ? (
          <p className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-[12px] text-[var(--maher-text-secondary)]">
            {delivery.customerStatus ? <Stamp tone={statusTone(delivery.customerStatus)} size="sm">{safeStatus(delivery.customerStatus)}</Stamp> : null}
            {delivery.calendarDate ? <Ltr>{delivery.calendarDate}</Ltr> : null}
          </p>
        ) : null}
      </div>
    </Board>
  );
}

export default function OrdersPage() {
  const t = useTranslations('sales');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const tl = useTranslations('lifecycle');
  const tStatus = useTranslations('statuses');
  const kit = useKitCopy();
  const [tab, setTab] = useState<OrderLifecycleTab>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const requestsQuery = useQuery({
    queryKey: ['customer-requests'],
    queryFn: async () => {
      const json = await apiFetch<{ data?: RequestRow[] } | RequestRow[]>(
        '/api/v1/requests?pageSize=50',
      );
      return asRows<RequestRow>(json);
    },
  });

  const salesOrdersQuery = useQuery({
    queryKey: ['customer-orders'],
    queryFn: async () => {
      const json = await apiFetch<{ data?: SalesOrderRow[] } | SalesOrderRow[]>(
        '/api/v1/sales-orders?pageSize=50',
      );
      return asRows<SalesOrderRow>(json);
    },
  });

  const deliveriesQuery = useQuery({
    queryKey: ['customer-own-deliveries'],
    queryFn: () =>
      apiFetch<OwnDeliveriesResponse>('/api/v1/scheduling/own-deliveries').catch(() => ({
        summary: { upcoming: 0, thisWeek: 0, awaitingConfirmation: 0, mayBeDelayed: 0 },
        data: [],
      })),
  });

  const deliveryRows = useMemo(() => asRows<DealerDeliveryRow>(deliveriesQuery.data), [deliveriesQuery.data]);
  const salesOrderRows = useMemo(() => asRows<SalesOrderRow>(salesOrdersQuery.data), [salesOrdersQuery.data]);
  const requestRows = useMemo(() => asRows<RequestRow>(requestsQuery.data), [requestsQuery.data]);

  const deliveryByOrderId = useMemo(() => {
    const map = new Map<string, DealerDeliveryRow>();
    for (const row of deliveryRows) {
      map.set(row.salesOrderId, row);
    }
    return map;
  }, [deliveryRows]);

  const deliveryStatusByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of deliveryRows) {
      const status = deliveryStatusFromCustomerStatus(row.customerStatus);
      if (status) map.set(row.salesOrderId, status);
    }
    return map;
  }, [deliveryRows]);

  const rows = useMemo<HubRow[]>(() => {
    const salesOrders: HubRow[] = salesOrderRows.map((row) => ({
      kind: 'sales_order' as const,
      ...row,
      deliveryStatus: deliveryStatusByOrderId.get(row.id) ?? null,
    }));
    const rfqs: HubRow[] = requestRows
      .filter((r) => !['QUOTED', 'CLOSED', 'CANCELLED'].includes(r.status))
      .map((row) => ({ kind: 'rfq' as const, ...row }));
    return [...rfqs, ...salesOrders];
  }, [salesOrderRows, requestRows, deliveryStatusByOrderId]);

  const tabCounts = useMemo(() => countLifecycleTabs(rows), [rows]);

  const filteredRows = useMemo(() => {
    let next = rows.filter((row) => matchesLifecycleTab(row, tab));
    if (debouncedSearch) {
      next = next.filter((row) =>
        matchOrderSearch(
          {
            number: row.number,
            title: orderTitle(row),
            externalOrderNumber: dealerOrderNumber(row),
            endCustomerName: row.kind === 'rfq' ? row.endCustomerName : null,
          },
          debouncedSearch,
        ),
      );
    }
    return next;
  }, [rows, tab, debouncedSearch]);

  const rfqPreviewDocIds = useMemo(() => {
    const ids: string[] = [];
    for (const row of requestRows) {
      const doc = firstImageDoc(row.documents);
      if (doc) ids.push(doc.id);
    }
    return ids;
  }, [requestRows]);

  const rfqImageLinksQuery = useQuery({
    queryKey: ['customer-request-card-images', rfqPreviewDocIds.join(',')],
    enabled: rfqPreviewDocIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        rfqPreviewDocIds.map(async (docId) => {
          try {
            const res = await apiFetch<{ downloadPath: string }>(
              `/api/v1/uploads/documents/${docId}/link`,
            );
            return [docId, `${API_URL}${res.downloadPath}`] as const;
          } catch {
            return [docId, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  function cardImageUrl(row: HubRow): string | null {
    const catalog = mediaSrc(row.imageUrl);
    if (catalog) return catalog;
    if (row.kind === 'rfq') {
      const doc = firstImageDoc(row.documents);
      if (doc) {
        const linked = rfqImageLinksQuery.data?.[doc.id];
        if (linked) return linked;
      }
    }
    return null;
  }

  const isLoading = requestsQuery.isLoading || salesOrdersQuery.isLoading;
  const isError = requestsQuery.isError || salesOrdersQuery.isError;
  const emptyKey = lifecycleEmptyMessageKey(tab, Boolean(debouncedSearch));

  if (isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <BoardSkeleton key={i} rows={3} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBoard
        title={tNav('myOrders')}
        description={tCommon('loadFailed')}
        onRetry={() => {
          void requestsQuery.refetch();
          void salesOrdersQuery.refetch();
        }}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const lanes = ORDER_LIFECYCLE_TABS.filter((key) => key !== 'all');
  const attention = (tabCounts.needsInformation ?? 0) + (tabCounts.ready ?? 0);
  const heroTone: BoardTone = tabCounts.needsInformation ? 'warning' : tabCounts.ready ? 'success' : 'brand';

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={heroTone} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tNav('myOrders')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tCommon('ordersSubtitle')}</p>
            </div>
            <Link href="/dealer/orders/new">
              <Button>{tNav('createOrder')}</Button>
            </Link>
          </div>
          <div className="min-w-0">
            <Ribbon size="sm" segments={lanes.map((key) => ({ key, label: tl(`tabs.${key}`), value: tabCounts[key] ?? 0, tone: TAB_TONE[key] }))} />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={rows.length} label={tl('tabs.all')} />
              <Figure size="sm" value={tabCounts.inProduction ?? 0} label={tl('tabs.inProduction')} tone="brand" />
              <Figure size="sm" value={attention} label={tl('tabs.ready')} tone={attention ? heroTone : 'neutral'} />
            </div>
          </div>
        </div>
      </Board>

      <ListToolbar copy={kit.toolbar} search={{ value: searchInput, onChange: setSearchInput, placeholder: tl('searchOrders') }} />

      <StatusChips
        aria-label={tNav('myOrders')}
        value={tab}
        onChange={(id) => setTab(id as OrderLifecycleTab)}
        items={ORDER_LIFECYCLE_TABS.map((key) => ({ id: key, label: tl(`tabs.${key}`), count: tabCounts[key] ?? 0, tone: key === 'all' ? undefined : TAB_TONE[key] }))}
      />

      {filteredRows.length === 0 ? (
        <Board tone="neutral" key={`empty-${tab}-${debouncedSearch}`}>
          <Board.Empty
            title={tl(emptyKey, debouncedSearch ? { query: debouncedSearch } : undefined)}
            description={tab === 'all' ? tc('noOrdersYetHint') : undefined}
            action={tab !== 'all' ? <Button size="sm" variant="secondary" onClick={() => setTab('all')}>{tl('tabs.all')}</Button> : <Link href="/dealer/catalog"><Button size="sm">{tNav('catalog')}</Button></Link>}
          />
        </Board>
      ) : (
        <ul key={`${tab}-${debouncedSearch}`} className="maher-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredRows.map((row) => (
            <OrderCard
              key={`${row.kind}-${row.id}`}
              row={row}
              title={orderTitle(row)}
              imageUrl={cardImageUrl(row)}
              detailHref={row.kind === 'rfq' ? `/dealer/orders/requests/${row.id}` : `/dealer/orders/${row.id}`}
              tSales={t}
              tLifecycle={tl}
              tStatus={tStatus}
              delivery={row.kind === 'sales_order' ? deliveryByOrderId.get(row.id) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
