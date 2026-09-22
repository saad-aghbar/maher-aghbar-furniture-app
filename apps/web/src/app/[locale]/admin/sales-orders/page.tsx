'use client';

import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { OrdersListHero } from '@/components/orders/orders-list-hero';
import {
  JOURNEY_BUCKETS,
  daysUntil,
  dueTone,
  isClosedSalesOrder,
  journeyTone,
  salesOrderTone,
  useOrdersCopy,
  type JourneyBucket,
  type SalesOrderRow,
} from '@/components/orders/orders-shared';
import { CancelImpactSheet } from '@/components/sales-orders/cancel-impact-sheet';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName } from '@maher/i18n';
import {
  Board,
  Button,
  ConfirmDialog,
  DataBoard,
  DateRangeField,
  ErrorBoard,
  FilterChip,
  FilterDrawer,
  FilterGroup,
  ListToolbar,
  Ltr,
  Menu,
  Meter,
  Pagination,
  RowThumb,
  Stamp,
  StatusChips,
  useToast,
  type DataColumn,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

type SortKey = 'createdAt' | 'requiredDeliveryDate' | 'number' | 'total';
type DeliveryPreset = '' | 'overdue' | 'week' | 'month' | 'custom';

const HOLDABLE = new Set(['CONFIRMED', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'WAITING_FOR_MATERIALS', 'WAITING_FOR_PAYMENT']);

const DEFAULTS = {
  q: '',
  bucket: '' as JourneyBucket | '',
  customerId: '',
  orderType: '',
  returned: false,
  delivery: '' as DeliveryPreset,
  deliveryFrom: '',
  deliveryTo: '',
  sortBy: 'createdAt' as SortKey,
  sortDir: 'desc' as 'asc' | 'desc',
  page: 1,
  pageSize: 20,
};

type ListMeta = Paginated<SalesOrderRow>['meta'] & {
  journeyCounts?: Partial<Record<JourneyBucket, number>>;
  returned?: number;
};

function presetRange(preset: DeliveryPreset, from: string, to: string): { deliveryFrom?: string; deliveryTo?: string } {
  const today = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case 'overdue':
      return { deliveryTo: ymd(new Date(today.getTime() - 86_400_000)) };
    case 'week': {
      const end = new Date(today);
      end.setDate(today.getDate() + 7);
      return { deliveryFrom: ymd(today), deliveryTo: ymd(end) };
    }
    case 'month': {
      const end = new Date(today);
      end.setDate(today.getDate() + 30);
      return { deliveryFrom: ymd(today), deliveryTo: ymd(end) };
    }
    case 'custom':
      return { deliveryFrom: from || undefined, deliveryTo: to || undefined };
    default:
      return {};
  }
}

function SalesOrdersPageInner() {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const t = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { params, set, reset, activeCount } = useListParams({ defaults: DEFAULTS });

  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiQuery = useMemo(() => {
    const range = presetRange(params.delivery, params.deliveryFrom, params.deliveryTo);
    return toApiQuery({
      page: params.page,
      pageSize: params.pageSize,
      q: params.q.trim(),
      journeyBucket: params.bucket || undefined,
      customerId: params.customerId || undefined,
      orderType: params.orderType || undefined,
      returned: params.returned ? 'true' : undefined,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      ...range,
    });
  }, [params]);

  const list = useQuery({
    queryKey: ['sales-orders', apiQuery],
    queryFn: () => apiFetch<{ data: SalesOrderRow[]; meta: ListMeta }>(`/api/v1/sales-orders${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    await queryClient.invalidateQueries({ queryKey: ['section-counts'] });
  };

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/sales-orders/${id}/confirm`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirmId(null);
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      toast.success(tSales('confirmedBanner'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const holdMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/api/v1/sales-orders/${id}/hold`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      setError(null);
      setHoldId(null);
      await invalidate();
      toast.success(tSales('heldBanner'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/sales-orders/${id}/resume`, { method: 'POST' }),
    onSuccess: async () => {
      await invalidate();
      toast.success(tSales('resumedBanner'));
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const counts = (meta?.journeyCounts ?? {}) as Partial<Record<JourneyBucket | 'all', number>>;
  const allCount = counts.all ?? JOURNEY_BUCKETS.reduce((a, b) => a + (counts[b] ?? 0), 0) ?? meta?.totalItems;

  const columns: DataColumn<SalesOrderRow>[] = [
    {
      key: 'number',
      header: tSales('systemOrderNumber'),
      sortKey: 'number',
      cell: (row) => (
        <span className="flex items-center gap-3">
          <RowThumb src={row.imageUrl} icon={<Stamp tone={salesOrderTone(row.status)} />} />
          <span className="min-w-0">
            <Ltr block className="font-semibold text-[var(--maher-text-primary)]">{row.number}</Ltr>
            <span className="block truncate text-[12px] text-[var(--maher-text-secondary)]">
              {row.title || row.projectName || (row.lineCount ? tSales('desk.lineCount', { count: row.lineCount }) : '')}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'customer',
      header: tSales('customer'),
      hideBelow: 'md',
      cell: (row) => (
        <span className="block">
          <span className="block truncate">{row.customer ? localizedName(copy.locale, row.customer, row.customer.name ?? '') : '—'}</span>
          {row.externalOrderNumber ? <Ltr block className="text-[12px] text-[var(--maher-text-tertiary)]">{row.externalOrderNumber}</Ltr> : null}
        </span>
      ),
    },
    {
      key: 'journey',
      header: tSales('desk.stage'),
      hideBelow: 'lg',
      cell: (row) => (
        <span className="flex min-w-[140px] flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[12px]">
            <Stamp tone={journeyTone(row.journeyBucket)} />
            {row.journeyBucket ? copy.journey(row.journeyBucket) : copy.status(row.status)}
            {row.hasPendingReturn ? (
              <Stamp size="sm" tone="warning">
                {tSales('desk.returnOpen')}
              </Stamp>
            ) : null}
          </span>
          {row.progressPercent != null && row.journeyBucket === 'in_production' ? (
            <Meter value={row.progressPercent} max={100} size="sm" showValue={false} tone="info" />
          ) : null}
        </span>
      ),
    },
    {
      key: 'status',
      header: tCommon('status'),
      hideBelow: 'xl',
      cell: (row) => (
        <Stamp tone={salesOrderTone(row.status)} size="sm">
          {copy.status(row.status)}
        </Stamp>
      ),
    },
    {
      key: 'delivery',
      header: tSales('deliveryDate'),
      sortKey: 'requiredDeliveryDate',
      numeric: true,
      cell: (row) => {
        const date = row.journeyLogistics?.committedDeliveryDate ?? row.requiredDeliveryDate ?? row.requestedDeliveryDate;
        const days = daysUntil(date);
        const tone = dueTone(days, isClosedSalesOrder(row.status));
        return (
          <span className="flex flex-col items-end">
            <span>{copy.date(date)}</span>
            {days != null && !isClosedSalesOrder(row.status) ? (
              <span className="text-[11px]" style={{ color: tone === 'neutral' ? 'var(--maher-text-tertiary)' : `var(--maher-${tone})` }}>
                {copy.dueLabel(days)}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: tSales('total'),
      sortKey: 'total',
      numeric: true,
      hideBelow: 'md',
      cell: (row) => (row.total != null ? copy.money(row.total, row.currency ?? 'ILS') : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      cell: (row) => (
        <Menu
          LinkComponent={Link}
          aria-label={tSales('moreActions')}
          trigger={
            <Button variant="ghost" size="icon" aria-label={tSales('moreActions')} className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
          items={[
            { id: 'open', label: tCommon('details'), href: `/admin/sales-orders/${row.id}` },
            ...(row.status === 'DRAFT' ? [{ id: 'confirm', label: tSales('confirmToProduction'), onSelect: () => setConfirmId(row.id) }] : []),
            ...(HOLDABLE.has(row.status) ? [{ id: 'hold', label: tSales('hold'), onSelect: () => setHoldId(row.id) }] : []),
            ...(row.status === 'ON_HOLD' ? [{ id: 'resume', label: tSales('resume'), onSelect: () => resumeMutation.mutate(row.id) }] : []),
            ...(row.status !== 'CANCELLED' && !isClosedSalesOrder(row.status)
              ? [{ id: 'cancel', label: tSales('cancelOrder'), tone: 'error' as const, separator: true, onSelect: () => setCancelId(row.id) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <OrdersListHero
        title={t('salesOrders')}
        description={tSales('desk.salesOrdersHint')}
        counts={JOURNEY_BUCKETS.map((b) => ({ key: b, label: copy.journey(b), count: counts[b] ?? 0, tone: journeyTone(b) }))}
        actions={
          <Link
            href="/admin/requests"
            className="maher-press inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-4 text-sm font-medium text-[var(--maher-text-primary)] hover:border-[var(--maher-border-strong)]"
          >
            <Plus className="h-4 w-4" />
            {tSales('desk.newFromRequest')}
          </Link>
        }
      />

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q }, { replace: true }), placeholder: tSales('searchPlaceholder') }}
        filterCount={activeCount - (params.bucket ? 1 : 0)}
        onOpenFilters={() => {
          setDraft(params);
          setFilterOpen(true);
        }}
        sort={{
          value: params.sortBy,
          dir: params.sortDir,
          onChange: (sortBy) => set({ sortBy }),
          onDirChange: (sortDir) => set({ sortDir }),
          options: (['createdAt', 'requiredDeliveryDate', 'number', 'total'] as SortKey[]).map((k) => ({ value: k, label: copy.tm(`sort.${k}`) })),
        }}
      >
        <StatusChips
          aria-label={tSales('desk.stage')}
          value={params.bucket || 'all'}
          onChange={(id) => set({ bucket: id === 'all' ? '' : (id as JourneyBucket) })}
          items={[
            { id: 'all', label: copy.journey('all'), count: allCount ?? null },
            ...JOURNEY_BUCKETS.map((b) => ({ id: b, label: copy.journey(b), count: counts[b] ?? 0, tone: journeyTone(b) })),
          ]}
        />
      </ListToolbar>

      {list.isError && !list.data ? (
        <ErrorBoard title={tCommon('loadFailed')} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<SalesOrderRow>
          aria-label={t('salesOrders')}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/sales-orders/${r.id}`}
          LinkComponent={Link}
          loading={list.isLoading && !list.data}
          sort={{ key: params.sortBy, dir: params.sortDir }}
          onSort={(key) => set(params.sortBy === key ? { sortDir: params.sortDir === 'asc' ? 'desc' : 'asc' } : { sortBy: key as SortKey, sortDir: 'desc' })}
          rowClassName={(r) => (r.hasPendingReturn ? 'bg-[color:color-mix(in_oklab,var(--maher-warning)_6%,transparent)]' : undefined)}
          mobileRow={(row) => {
            const date = row.journeyLogistics?.committedDeliveryDate ?? row.requiredDeliveryDate ?? row.requestedDeliveryDate;
            return {
              leading: <RowThumb src={row.imageUrl} icon={<Stamp tone={salesOrderTone(row.status)} />} />,
              title: <Ltr>{row.number}</Ltr>,
              meta: `${row.customer ? localizedName(copy.locale, row.customer, row.customer.name ?? '') : '—'} · ${row.journeyBucket ? copy.journey(row.journeyBucket) : copy.status(row.status)}`,
              trailing: <span className="text-[12px] text-[var(--maher-text-secondary)]">{copy.date(date)}</span>,
            };
          }}
          empty={
            <Board.Empty
              title={params.q || activeCount ? tSales('desk.emptyFilteredTitle') : tSales('empty')}
              description={params.q || activeCount ? tSales('desk.emptyFilteredBody') : tSales('emptyHint')}
              action={
                params.q || activeCount ? (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    {tCommon('clearFilters')}
                  </Button>
                ) : null
              }
            />
          }
          footer={
            meta && meta.totalPages > 1 ? (
              <Pagination
                className="w-full"
                page={params.page}
                pageSize={params.pageSize}
                total={meta.totalItems}
                onPageChange={(page) => set({ page })}
                onPageSizeChange={(pageSize) => set({ pageSize, page: 1 })}
                copy={kit.pagination}
              />
            ) : null
          }
        />
      )}

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={kit.filters.title}
        applyLabel={kit.filters.apply}
        clearLabel={kit.filters.clear}
        closeLabel={kit.filters.close}
        onApply={() => set({ ...draft, page: 1 })}
        onClear={() => {
          setDraft(DEFAULTS);
          reset();
          setFilterOpen(false);
        }}
        count={[draft.customerId, draft.orderType, draft.returned, draft.delivery].filter(Boolean).length}
      >
        <FilterGroup title={copy.tm('filterDealerTitle')} layout="stack">
          <DealerCombobox value={draft.customerId || null} onChange={(customerId) => setDraft((d) => ({ ...d, customerId: customerId ?? '' }))} />
        </FilterGroup>
        <FilterGroup title={tSales('desk.orderType')}>
          {(['', 'STANDARD', 'MODIFIED', 'CUSTOM'] as const).map((type) => (
            <FilterChip key={type || 'all'} selected={draft.orderType === type} onClick={() => setDraft((d) => ({ ...d, orderType: type }))}>
              {type ? tSales(`desk.orderType${type}` as never) : tCommon('all')}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title={copy.tm('filterDelivery')} layout="stack">
          <div className="flex flex-wrap gap-2">
            {(['', 'overdue', 'week', 'month', 'custom'] as DeliveryPreset[]).map((preset) => (
              <FilterChip key={preset || 'any'} selected={draft.delivery === preset} onClick={() => setDraft((d) => ({ ...d, delivery: preset }))}>
                {copy.tm(`filterDeliveryPresets.${preset || 'any'}` as never)}
              </FilterChip>
            ))}
          </div>
          {draft.delivery === 'custom' ? (
            <DateRangeField
              from={draft.deliveryFrom}
              to={draft.deliveryTo}
              onChange={(r) => setDraft((d) => ({ ...d, deliveryFrom: r.from, deliveryTo: r.to }))}
              locale={copy.locale}
              copy={kit.range}
              presets={[]}
            />
          ) : null}
        </FilterGroup>
        <FilterGroup title={tSales('linkedReturns')}>
          <FilterChip selected={!draft.returned} onClick={() => setDraft((d) => ({ ...d, returned: false }))}>
            {tCommon('all')}
          </FilterChip>
          <FilterChip selected={draft.returned} onClick={() => setDraft((d) => ({ ...d, returned: true }))} count={meta?.returned ?? null}>
            {tSales('desk.withReturns')}
          </FilterChip>
        </FilterGroup>
      </FilterDrawer>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title={tSales('confirm')}
        description={tSales('confirmDescription')}
        confirmLabel={tSales('confirm')}
        cancelLabel={tCommon('cancel')}
        loading={confirmMutation.isPending}
        error={error}
        onConfirm={() => confirmId && confirmMutation.mutate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
      <ConfirmDialog
        open={Boolean(holdId)}
        title={tSales('hold')}
        description={tSales('holdDescription')}
        confirmLabel={tSales('hold')}
        cancelLabel={tCommon('cancel')}
        withReason
        reasonLabel={tCommon('reason')}
        loading={holdMutation.isPending}
        error={error}
        onConfirm={(reason) => holdId && holdMutation.mutate({ id: holdId, reason })}
        onClose={() => setHoldId(null)}
      />
      <CancelImpactSheet
        open={Boolean(cancelId)}
        salesOrderId={cancelId}
        onClose={() => setCancelId(null)}
        onCancelled={({ financialAttention }) => {
          void invalidate();
          toast.success(tSales('cancelledBanner'), financialAttention ? tSales('cancelImpact.financialAttentionBannerBody') : undefined);
        }}
      />
    </div>
  );
}

export default function SalesOrdersPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <SalesOrdersPageInner />
    </Suspense>
  );
}
