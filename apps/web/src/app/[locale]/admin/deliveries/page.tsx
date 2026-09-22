'use client';

import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { daysUntil, deliveryTone, useOrdersCopy } from '@/components/orders/orders-shared';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName } from '@maher/i18n';
import {
  addDaysYmd,
  Alert,
  anyToYmd,
  Board,
  Button,
  Combobox,
  DataBoard,
  type DataColumn,
  DayStrip,
  ErrorBoard,
  Figure,
  FilterChip,
  FilterDrawer,
  FilterGroup,
  Input,
  ListToolbar,
  Ltr,
  Meter,
  Pagination,
  Select,
  Sheet,
  Stamp,
  StatusChips,
  TextArea,
  todayYmd,
  useToast,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

interface SalesOrder {
  id: string;
  number: string;
  status: string;
  customer?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
}

interface DeliveryRow {
  id: string;
  number: string;
  status: string;
  deliveryAddress: string;
  deliveryDate?: string | null;
  customerConfirmedAt?: string | null;
  actualDeliveredAt?: string | null;
  customer?: { name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  load?: { total: number; loaded: number; incomplete: boolean } | null;
  attentionReasons?: Array<'OVERDUE_PLANNED' | 'INCOMPLETE_LOAD'>;
}

type Section = 'planned' | 'ready' | 'shipped' | 'delivered' | 'attention';
const SECTIONS: Section[] = ['attention', 'planned', 'ready', 'shipped', 'delivered'];
const SECTION_STATUS: Partial<Record<Section, string>> = { planned: 'PLANNED', ready: 'READY', shipped: 'OUT_FOR_DELIVERY', delivered: 'DELIVERED' };
const SECTION_TONE: Record<Section, 'brand' | 'info' | 'success' | 'warning' | 'neutral'> = {
  attention: 'warning',
  planned: 'brand',
  ready: 'info',
  shipped: 'info',
  delivered: 'success',
};

const DEFAULTS = { q: '', section: 'ready' as Section, dealerId: '', warehouseId: '', page: 1, pageSize: 20 };

function nextStatus(current: string): string | null {
  // Commercial DELIVERED is dealer confirm-receipt only — staff may only advance to truck departed.
  if (current === 'PLANNED') return 'READY';
  if (current === 'READY') return 'OUT_FOR_DELIVERY';
  return null;
}

function DeliveriesPageInner() {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const tl = useTranslations('lifecycle');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { params, set, reset } = useListParams({ defaults: DEFAULTS });

  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [salesOrderId, setSalesOrderId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState('');

  const apiQuery = useMemo(
    () =>
      toApiQuery({
        page: params.page,
        pageSize: params.pageSize,
        q: params.q.trim(),
        ...(params.section === 'attention' ? { attention: 'true' } : { status: SECTION_STATUS[params.section] }),
        dealerId: params.dealerId || undefined,
        warehouseId: params.warehouseId || undefined,
      }),
    [params],
  );

  const list = useQuery({
    queryKey: ['deliveries', apiQuery],
    queryFn: () => apiFetch<Paginated<DeliveryRow>>(`/api/v1/deliveries${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  // Section counts + the next-7-days pulse from one wider probe of open deliveries.
  const pulse = useQuery({
    queryKey: ['deliveries-pulse'],
    queryFn: async () => {
      const [attention, ...statuses] = await Promise.all([
        apiFetch<Paginated<unknown>>('/api/v1/deliveries?pageSize=1&attention=true').catch(() => null),
        ...(['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const).map((s) => apiFetch<Paginated<DeliveryRow>>(`/api/v1/deliveries?pageSize=100&status=${s}`).catch(() => null)),
      ]);
      const counts: Record<Section, number | null> = {
        attention: attention?.meta.totalItems ?? null,
        planned: statuses[0]?.meta.totalItems ?? null,
        ready: statuses[1]?.meta.totalItems ?? null,
        shipped: statuses[2]?.meta.totalItems ?? null,
        delivered: statuses[3]?.meta.totalItems ?? null,
      };
      const open = [...(statuses[0]?.data ?? []), ...(statuses[1]?.data ?? [])];
      const today = todayYmd();
      const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i));
      const byDay = new Map(days.map((d) => [d, 0]));
      let overdue = 0;
      open.forEach((d) => {
        const ymd = anyToYmd(d.deliveryDate);
        if (!ymd) return;
        if (ymd < today) overdue += 1;
        else if (byDay.has(ymd)) byDay.set(ymd, (byDay.get(ymd) ?? 0) + 1);
      });
      return { counts, days: days.map((d) => ({ date: d, count: byDay.get(d) ?? 0 })), overdue, openTotal: open.length };
    },
    staleTime: 60_000,
  });

  const drivers = useQuery({
    queryKey: ['drivers-pick'],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; firstName: string; lastName: string; roles?: Array<{ role: { code: string } }> }> }>('/api/v1/users?pageSize=100').then((r) =>
        (r.data ?? []).filter((u) => u.roles?.some((role) => role.role.code === 'PRODUCTION_WORKER')),
      ),
  });
  const readyOrders = useQuery({
    queryKey: ['sales-orders-pick-delivery'],
    queryFn: () => apiFetch<{ data: SalesOrder[] }>('/api/v1/sales-orders?pageSize=100&status=READY_FOR_DELIVERY').then((r) => r.data),
    enabled: createOpen,
  });
  const warehouses = useQuery({
    queryKey: ['delivery-filter-warehouses'],
    queryFn: () => apiFetch<Array<{ id: string; code: string; nameEn: string; nameAr?: string | null; nameHe?: string | null }>>('/api/v1/inventory/warehouses'),
  });

  const invalidate = async () => {
    await Promise.all(
      ['deliveries', 'deliveries-pulse', 'section-counts', 'inventory', 'inventory-finished-lots', 'inventory-semi-finished', 'production-orders', 'production-order'].map((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      ),
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!salesOrderId || !deliveryAddress.trim()) throw new ApiClientError(tc('salesOrderAddressRequired'), 400);
      const so = (readyOrders.data ?? []).find((s) => s.id === salesOrderId);
      if (!so?.customer?.id) throw new ApiClientError(tc('salesOrderAddressRequired'), 400);
      return apiFetch('/api/v1/deliveries', {
        method: 'POST',
        body: JSON.stringify({ customerId: so.customer.id, salesOrderId, deliveryAddress: deliveryAddress.trim(), notes: notes.trim() || undefined }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await invalidate();
      setCreateOpen(false);
      toast.success(tc('deliveryPlanned'));
      set({ section: 'planned' });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (args: { id: string; status: string; driverId?: string }) => apiFetch(`/api/v1/deliveries/${args.id}/status`, { method: 'PATCH', body: JSON.stringify(args) }),
    onSuccess: async () => {
      await invalidate();
      toast.success(tc('deliveryStatusUpdated'));
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const counts = pulse.data?.counts;

  const sectionLabel = (s: Section) =>
    ({ ready: tl('adminDeliveryReady'), planned: tl('adminDeliveryPlanned'), shipped: tl('adminDeliveryShipped'), delivered: tl('adminDeliveryDelivered'), attention: tl('adminDeliveryAttention') })[s];
  const emptyTitle = (s: Section) => ({ ready: tl('noReady'), planned: tc('noDeliveries'), shipped: tl('noShipped'), delivered: tl('noDelivered'), attention: tl('noAttentionDeliveries') })[s];

  const attentionWhy = (row: DeliveryRow) =>
    (row.attentionReasons ?? []).map((reason) =>
      reason === 'OVERDUE_PLANNED' ? tl('attentionOverduePlanned') : tl('attentionIncompleteLoad', { loaded: row.load?.loaded ?? 0, total: row.load?.total ?? 0 }),
    );

  const columns: DataColumn<DeliveryRow>[] = [
    {
      key: 'number',
      header: tCommon('number'),
      cell: (row) => (
        <span className="flex items-center gap-3">
          <Stamp tone={row.attentionReasons?.length ? 'warning' : deliveryTone(row.status)} />
          <span className="min-w-0">
            <Ltr block className="font-semibold text-[var(--maher-text-primary)]">{row.number}</Ltr>
            <Ltr block className="text-[12px] text-[var(--maher-text-secondary)]">
              {row.salesOrder?.number ?? '—'}
              {row.salesOrder?.externalOrderNumber?.trim() ? ` · ${row.salesOrder.externalOrderNumber.trim()}` : ''}
            </Ltr>
          </span>
        </span>
      ),
    },
    {
      key: 'customer',
      header: tc('customer'),
      hideBelow: 'md',
      cell: (row) => (
        <span className="block">
          <span className="block truncate">{row.customer ? localizedName(copy.locale, row.customer, row.customer.name) : '—'}</span>
          <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{row.deliveryAddress}</span>
        </span>
      ),
    },
    {
      key: 'load',
      header: tSales('desk.load'),
      hideBelow: 'lg',
      cell: (row) =>
        row.load && row.load.total > 0 ? (
          <span className="block min-w-[120px]">
            <Meter value={row.load.loaded} max={row.load.total} size="sm" tone={row.load.incomplete ? 'warning' : 'success'} valueLabel={`${row.load.loaded}/${row.load.total}`} />
          </span>
        ) : (
          <span className="text-[var(--maher-text-tertiary)]">—</span>
        ),
    },
    {
      key: 'status',
      header: tCommon('status'),
      cell: (row) => {
        const why = attentionWhy(row);
        return (
          <span className="flex flex-col items-start gap-1">
            <Stamp tone={deliveryTone(row.status)} size="sm">
              {copy.status(row.status)}
            </Stamp>
            {row.status === 'OUT_FOR_DELIVERY' ? <span className="text-[11px] text-[var(--maher-text-tertiary)]">{tl('awaitingDealerConfirmation')}</span> : null}
            {why.map((line) => (
              <span key={line} className="text-[11px] text-[var(--maher-warning)]">
                {line}
              </span>
            ))}
          </span>
        );
      },
    },
    {
      key: 'date',
      header: tSales('deliveryDate'),
      numeric: true,
      cell: (row) => {
        const days = daysUntil(row.deliveryDate);
        const closed = row.status === 'DELIVERED' || row.status === 'CANCELLED' || row.status === 'OUT_FOR_DELIVERY';
        return (
          <span className="flex flex-col items-end">
            <span>{copy.date(row.deliveryDate)}</span>
            {!closed && days != null ? (
              <span className="text-[11px]" style={{ color: days < 0 ? 'var(--maher-error)' : days <= 1 ? 'var(--maher-warning)' : 'var(--maher-text-tertiary)' }}>
                {copy.dueLabel(days)}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: '',
      width: '180px',
      cell: (row) => {
        const next = nextStatus(row.status);
        if (!next) return null;
        return (
          <Button
            size="sm"
            variant={next === 'OUT_FOR_DELIVERY' ? 'primary' : 'secondary'}
            loading={statusMutation.isPending && statusMutation.variables?.id === row.id}
            leadingIcon={next === 'OUT_FOR_DELIVERY' ? <Truck className="h-4 w-4" /> : undefined}
            onClick={() => statusMutation.mutate({ id: row.id, status: next, driverId: next === 'OUT_FOR_DELIVERY' ? driverId || undefined : undefined })}
          >
            {next === 'OUT_FOR_DELIVERY' ? tl('markTruckDeparted') : tc('advanceTo', { status: tStatus(next as never) })}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={pulse.data?.overdue ? 'warning' : 'brand'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('deliveries')}</h1>
                <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tSales('desk.deliveriesHint')}</p>
              </div>
              <Button
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setSalesOrderId(null);
                  setDeliveryAddress('');
                  setNotes('');
                  setFormError(null);
                  setCreateOpen(true);
                }}
              >
                {tc('planDelivery')}
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <Figure size="sm" value={counts?.ready ?? 0} label={tl('adminDeliveryReady')} tone={counts?.ready ? 'info' : 'neutral'} />
              <Figure size="sm" value={counts?.shipped ?? 0} label={tl('adminDeliveryShipped')} tone={counts?.shipped ? undefined : 'neutral'} />
              <Figure size="sm" value={pulse.data?.overdue ?? 0} label={tl('attentionOverduePlanned')} tone={pulse.data?.overdue ? 'error' : 'neutral'} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{tSales('desk.deliveriesNext7')}</p>
            <DayStrip
              columns={(pulse.data?.days ?? Array.from({ length: 7 }, (_, i) => ({ date: addDaysYmd(todayYmd(), i), count: 0 }))).map((d) => ({
                key: d.date,
                label: new Intl.DateTimeFormat(copy.locale, { weekday: 'short' }).format(new Date(`${d.date}T00:00:00`)),
                value: d.count,
                today: d.date === todayYmd(),
                tone: d.count > 0 ? ('brand' as const) : undefined,
              }))}
            />
          </div>
        </div>
      </Board>

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q }, { replace: true }), placeholder: copy.tm('searchDeliveries') }}
        filterCount={[params.dealerId, params.warehouseId].filter(Boolean).length}
        onOpenFilters={() => {
          setDraft(params);
          setFilterOpen(true);
        }}
        actions={
          <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-label={tc('defaultDriver')} className="w-44">
            <option value="">{tc('currentUser')}</option>
            {(drivers.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.firstName} {d.lastName}
              </option>
            ))}
          </Select>
        }
      >
        <StatusChips
          aria-label={t('deliveries')}
          value={params.section}
          onChange={(section) => set({ section: section as Section })}
          items={SECTIONS.map((s) => ({ id: s, label: sectionLabel(s), count: counts?.[s] ?? null, tone: SECTION_TONE[s] }))}
        />
      </ListToolbar>

      {list.isError && !list.data ? (
        <ErrorBoard title={tCommon('loadFailed')} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<DeliveryRow>
          aria-label={t('deliveries')}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/deliveries/${r.id}`}
          LinkComponent={Link}
          loading={list.isLoading && !list.data}
          rowClassName={(r) => (r.attentionReasons?.length ? 'bg-[color:color-mix(in_oklab,var(--maher-warning)_6%,transparent)]' : undefined)}
          mobileRow={(row) => ({
            tone: row.attentionReasons?.length ? 'warning' : deliveryTone(row.status),
            title: <Ltr>{row.number}</Ltr>,
            meta: `${row.customer ? localizedName(copy.locale, row.customer, row.customer.name) : '—'} · ${copy.status(row.status)}`,
            trailing: <span className="text-[12px] text-[var(--maher-text-secondary)]">{copy.date(row.deliveryDate)}</span>,
          })}
          empty={
            <Board.Empty
              title={emptyTitle(params.section)}
              description={tSales('desk.deliveriesEmptyBody')}
              action={
                params.section === 'planned' ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    {tc('planDelivery')}
                  </Button>
                ) : params.q || params.dealerId || params.warehouseId ? (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    {tCommon('clearFilters')}
                  </Button>
                ) : null
              }
            />
          }
          footer={meta && meta.totalPages > 1 ? <Pagination className="w-full" page={params.page} pageSize={params.pageSize} total={meta.totalItems} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
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
        count={[draft.dealerId, draft.warehouseId].filter(Boolean).length}
      >
        <FilterGroup title={copy.tm('filterDealerTitle')} layout="stack">
          <DealerCombobox value={draft.dealerId || null} onChange={(id) => setDraft((d) => ({ ...d, dealerId: id ?? '' }))} />
        </FilterGroup>
        <FilterGroup title={tl('returns.warehouse')}>
          <FilterChip selected={!draft.warehouseId} onClick={() => setDraft((d) => ({ ...d, warehouseId: '' }))}>
            {tCommon('all')}
          </FilterChip>
          {(warehouses.data ?? []).map((w) => (
            <FilterChip key={w.id} selected={draft.warehouseId === w.id} onClick={() => setDraft((d) => ({ ...d, warehouseId: w.id }))}>
              {localizedName(copy.locale, w, w.code)}
            </FilterChip>
          ))}
        </FilterGroup>
      </FilterDrawer>

      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tc('planDelivery')}
        description={tc('readyForDeliveryOnly')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Combobox
            label={tc('salesOrder')}
            value={salesOrderId}
            onChange={(id) => setSalesOrderId(id)}
            options={(readyOrders.data ?? []).map((s) => ({
              value: s.id,
              label: s.number,
              description: s.customer ? localizedName(copy.locale, s.customer, s.customer.name) : tStatus(s.status as never),
            }))}
            placeholder={tc('select')}
            emptyText={readyOrders.isLoading ? kit.combobox.loading : kit.combobox.empty}
            clearLabel={kit.combobox.clear}
          />
          <Input label={tc('deliveryAddress')} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required />
          <TextArea autoGrow rows={2} label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Sheet>
    </div>
  );
}

export default function DeliveriesPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <DeliveriesPageInner />
    </Suspense>
  );
}
