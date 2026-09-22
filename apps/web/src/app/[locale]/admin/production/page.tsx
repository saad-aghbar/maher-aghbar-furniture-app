'use client';

import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { ProductionBasketBoard, type ProductionBasket } from '@/components/production/production-basket-board';
import { bucketTone, COMPLEXITIES, PRIORITIES, PRODUCTION_BUCKETS, priorityTone, productionTone, useProductionCopy, type AssignableWorker, type Complexity, type DaySummary, type Priority, type ProductionBucket, type ProductionRow } from '@/components/production/production-shared';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName } from '@maher/i18n';
import { Board, Button, Combobox, ConfirmDialog, DataBoard, DateField, DayStrip, ErrorBoard, Figure, FilterDrawer, ListToolbar, Ltr, Meter, Pagination, Ribbon, RowThumb, SegmentedControl, Stamp, StatusChips, addDaysYmd, todayYmd, useToast, type DataColumn } from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, LayoutGrid, List, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

const DEFAULTS = {
  q: '',
  bucket: '' as '' | Exclude<ProductionBucket, 'all'>,
  priority: '' as '' | Priority,
  origin: '' as '' | 'normal' | 'returned',
  complexity: '' as '' | Complexity,
  customerId: '',
  assignedEmployeeId: '',
  onDate: '',
  dateMode: 'planned' as 'planned' | 'actual',
  dayFocus: '' as '' | 'late_missed' | 'at_risk',
  view: 'orders' as 'orders' | 'boards',
  page: 1,
  pageSize: 25,
};

const START_STATUSES = new Set(['DRAFT', 'PLANNED', 'READY', 'WAITING_FOR_MATERIALS']);

function ProductionPageInner() {
  const copy = useProductionCopy();
  const t = useTranslations('navigation');
  const tp = useTranslations('production');
  const tm = useTranslations('mobile.production');
  const tSales = useTranslations('sales');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { params, set, reset, activeCount } = useListParams({ defaults: DEFAULTS });
  const [filterOpen, setFilterOpen] = useState(false);
  const [startRow, setStartRow] = useState<ProductionRow | null>(null);

  const listFilters = useMemo(
    () => ({
      q: params.q.trim() || undefined,
      bucket: params.bucket || undefined,
      priority: params.priority || undefined,
      origin: params.origin || undefined,
      complexity: params.complexity || undefined,
      customerId: params.customerId || undefined,
      assignedEmployeeId: params.assignedEmployeeId || undefined,
      onDate: params.onDate || undefined,
      dateMode: params.onDate ? params.dateMode : undefined,
      dayFocus: params.onDate && params.dayFocus ? params.dayFocus : undefined,
    }),
    [params],
  );
  const apiQuery = useMemo(() => toApiQuery({ ...listFilters, page: params.page, pageSize: params.pageSize }), [listFilters, params.page, params.pageSize]);
  const list = useQuery({ queryKey: ['production-orders', apiQuery], queryFn: () => apiFetch<Paginated<ProductionRow>>(`/api/v1/production-orders${apiQuery}`), placeholderData: keepPreviousData, enabled: params.view === 'orders' });
  const boards = useQuery({ queryKey: ['production-orders-boards', apiQuery], queryFn: () => apiFetch<{ data: ProductionBasket[] }>(`/api/v1/production-orders${apiQuery}&group=boards`), placeholderData: keepPreviousData, enabled: params.view === 'boards' });

  // Mobile-only day lens: lane counts for the focused day + next 7 days planned load.
  const focusDate = params.onDate || todayYmd();
  const summary = useQuery({
    queryKey: ['production-day-summary', focusDate, params.dateMode, params.customerId, params.origin],
    queryFn: () => apiFetch<DaySummary>(`/api/v1/production-orders/day-summary${toApiQuery({ onDate: focusDate, dateMode: params.dateMode, customerId: params.customerId || undefined, origin: params.origin || undefined })}`),
    staleTime: 30_000,
  });
  const week = useQuery({
    queryKey: ['production-week-summary', params.customerId],
    queryFn: async () => {
      const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(todayYmd(), i));
      const rows = await Promise.all(days.map((d) => apiFetch<DaySummary>(`/api/v1/production-orders/day-summary${toApiQuery({ onDate: d, dateMode: 'planned', customerId: params.customerId || undefined })}`).catch(() => null)));
      return days.map((date, i) => ({ date, planned: rows[i]?.planned.orders ?? 0, late: rows[i]?.lateMissed ?? 0 }));
    },
    staleTime: 60_000,
  });
  // Lane totals across the whole floor (not day-scoped): one tiny request per lane.
  const lanesQuery = useQuery({
    queryKey: ['production-lane-counts', params.customerId, params.origin],
    queryFn: async () => {
      const entries = await Promise.all(
        PRODUCTION_BUCKETS.map(async (b) => {
          const res = await apiFetch<Paginated<ProductionRow>>(`/api/v1/production-orders${toApiQuery({ bucket: b, pageSize: 1, page: 1, customerId: params.customerId || undefined, origin: params.origin || undefined })}`).catch(() => null);
          return [b, res?.meta.totalItems ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<Exclude<ProductionBucket, 'all'>, number>;
    },
    staleTime: 60_000,
  });
  const workers = useQuery({ queryKey: ['assignable-workers'], queryFn: () => apiFetch<AssignableWorker[]>('/api/v1/production-orders/assignable-workers'), staleTime: 60_000, enabled: filterOpen || Boolean(params.assignedEmployeeId) });

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ['production-orders'] }), qc.invalidateQueries({ queryKey: ['production-orders-boards'] }), qc.invalidateQueries({ queryKey: ['production-day-summary'] })]);
  const start = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/production-orders/${id}/start`, { method: 'POST' }),
    onSuccess: async () => {
      setStartRow(null);
      toast.success(tc('productionStarted'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const s = summary.data;
  const lanes = lanesQuery.data;
  const laneCount = (b: Exclude<ProductionBucket, 'all'>) => lanes?.[b] ?? null;
  const laneSegments = lanes
    ? (['needs_setup', 'ready_to_start', 'on_floor', 'blocked', 'inspection_packaging'] as const).map((b) => ({ key: b, label: copy.bucket(b), value: lanes[b], tone: bucketTone(b) }))
    : [];

  const title = (row: ProductionRow) => (row.product ? localizedName(copy.locale, { nameEn: row.product.nameEn ?? '', nameAr: row.product.nameAr, nameHe: row.product.nameHe }, row.product.nameEn ?? '') : row.productDescription || row.number);
  const stage = (row: ProductionRow) => (row.currentStage ? localizedName(copy.locale, row.currentStage, row.currentStage.nameEn) : row.currentStageCode ?? copy.status(row.status));

  const columns: DataColumn<ProductionRow>[] = [
    {
      key: 'order',
      header: tp('orders'),
      cell: (row) => (
        <span className="flex items-center gap-3">
          <RowThumb src={row.imageUrl ?? row.product?.imageUrl} icon={<Armchair className="h-4 w-4" />} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{title(row)}</span>
            <Ltr className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
              {row.number}
              {row.salesOrder ? ` · ${row.salesOrder.externalOrderNumber?.trim() || row.salesOrder.number}` : ''}
            </Ltr>
          </span>
        </span>
      ),
    },
    { key: 'dealer', header: tm('dealer'), hideBelow: 'lg', cell: (row) => (row.customer ? localizedName(copy.locale, row.customer, row.customer.name) : '—') },
    {
      key: 'stage',
      header: tp('stage' as never),
      hideBelow: 'md',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Stamp tone={productionTone(row.status)} size="sm">
            {stage(row)}
          </Stamp>
          {row.originType === 'RETURN_WORK' || row.originType === 'REPLACEMENT' ? <Stamp tone="warning" size="sm">{row.originType === 'REPLACEMENT' ? tm('origin.replacement') : tm('origin.returnWork')}</Stamp> : null}
          {(row.openBlockersCount ?? 0) > 0 ? <Stamp tone="error" size="sm">{tm('blocked')}</Stamp> : null}
        </span>
      ),
    },
    {
      key: 'progress',
      header: tm('progress'),
      width: '180px',
      cell: (row) => <Meter value={Math.min(100, Math.max(0, Number(row.progressPercent ?? 0)))} max={100} size="sm" valueLabel={`${Math.round(Number(row.progressPercent ?? 0))}%`} tone={row.status === 'COMPLETED' ? 'success' : row.isLate ? 'error' : 'brand'} />,
    },
    {
      key: 'due',
      header: tm('dueDate'),
      hideBelow: 'md',
      cell: (row) => {
        const d = copy.daysUntil(row.plannedCompletionDate ?? row.requiredDeliveryDate);
        const late = row.status !== 'COMPLETED' && d != null && d < 0;
        return (
          <span className="flex flex-col">
            <span className={late ? 'font-semibold text-[var(--maher-error)]' : ''}>{copy.date(row.plannedCompletionDate ?? row.requiredDeliveryDate)}</span>
            {d != null && row.status !== 'COMPLETED' ? <span className="text-[12px] text-[var(--maher-text-tertiary)]">{late ? tSales('desk.lateBy', { count: Math.abs(d) }) : tSales('desk.dueIn', { count: d })}</span> : null}
          </span>
        );
      },
    },
    { key: 'priority', header: tm('priorityLabel'), hideBelow: 'xl', cell: (row) => <Stamp tone={priorityTone(row.priority)} size="sm">{copy.priority(row.priority)}</Stamp> },
    {
      key: 'actions',
      header: '',
      numeric: true,
      width: '120px',
      cell: (row) =>
        START_STATUSES.has(row.status) ? (
          <Button size="sm" variant="secondary" leadingIcon={<Play className="h-3.5 w-3.5" />} onClick={(e) => (e.preventDefault(), e.stopPropagation(), setStartRow(row))}>
            {tp('start')}
          </Button>
        ) : row.assignedEmployee ? (
          <span className="text-[12px] text-[var(--maher-text-secondary)]">{copy.worker(row.assignedEmployee)}</span>
        ) : null,
    },
  ];

  const filtered = Boolean(params.q || activeCount);

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={s && s.lateMissed > 0 ? 'error' : 'brand'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)] rtl:tracking-normal">{tm('pulseEyebrow')}</p>
                <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('production')}</h1>
                <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tm('subtitle')}</p>
              </div>
              <SegmentedControl
                size="sm"
                aria-label={tCommon('view')}
                value={params.view}
                onChange={(view) => set({ view }, { replace: true })}
                options={[
                  { value: 'orders', label: <span className="inline-flex items-center gap-1.5"><List className="h-4 w-4" />{tp('viewItems')}</span> },
                  { value: 'boards', label: <span className="inline-flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" />{tp('viewBoards')}</span> },
                ]}
              />
            </div>
            {laneSegments.length ? <Ribbon className="mt-4" segments={laneSegments} /> : null}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={s?.planned.orders ?? 0} label={tm('dayLens.plannedToday')} delta={s ? tm('dayLens.ordersTasks', { orders: s.planned.orders, tasks: s.planned.tasks }) : undefined} />
              <Figure size="sm" value={s?.actual.orders ?? 0} label={tm('dayLens.actualSoFar')} tone="info" />
              <Figure size="sm" value={s?.lateMissed ?? 0} label={tm('dayLens.lateMissed')} tone={s && s.lateMissed > 0 ? 'error' : 'success'} />
              <Figure size="sm" value={s?.atRisk ?? 0} label={tm('dayLens.atRisk')} tone={s && s.atRisk > 0 ? 'warning' : 'success'} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] leading-5 text-[var(--maher-text-secondary)]">{tm('dayLens.title')}</p>
              <div className="flex items-center gap-2">
                <SegmentedControl
                  size="sm"
                  aria-label={tm('dayLens.title')}
                  value={params.dateMode}
                  onChange={(v) => set({ dateMode: v as 'planned' | 'actual' }, { replace: true })}
                  options={[
                    { value: 'planned', label: tm('dayLens.planned') },
                    { value: 'actual', label: tm('dayLens.actual') },
                  ]}
                />
                <DateField aria-label={tm('dueDate')} value={params.onDate} onChange={(onDate) => set({ onDate, page: 1 })} copy={kit.date} locale={copy.locale} clearable todayShortcut className="w-40" />
              </div>
            </div>
            <DayStrip
              columns={(week.data ?? Array.from({ length: 7 }, (_, i) => ({ date: addDaysYmd(todayYmd(), i), planned: 0, late: 0 }))).map((d) => ({
                key: d.date,
                label: new Intl.DateTimeFormat(copy.locale, { weekday: 'short' }).format(new Date(`${d.date}T00:00:00`)),
                value: d.planned,
                compare: d.late || undefined,
                today: d.date === todayYmd(),
                tone: d.date === params.onDate ? ('brand' as const) : d.planned > 0 ? ('info' as const) : undefined,
                href: `?onDate=${d.date}`,
              }))}
              compareTone="error"
              LinkComponent={Link}
            />
            {params.onDate ? (
              <div className="mt-3">
                <StatusChips
                  aria-label={tm('dayLens.title')}
                  value={params.dayFocus || 'all'}
                  onChange={(id) => set({ dayFocus: id === 'all' ? '' : (id as 'late_missed' | 'at_risk'), page: 1 })}
                  items={[
                    { id: 'all', label: tCommon('all') },
                    { id: 'late_missed', label: tm('dayLens.lateMissed'), count: s?.lateMissed ?? null, tone: 'error' },
                    { id: 'at_risk', label: tm('dayLens.atRisk'), count: s?.atRisk ?? null, tone: 'warning' },
                  ]}
                />
              </div>
            ) : null}
          </div>
        </div>
      </Board>

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q, page: 1 }, { replace: true }), placeholder: tm('searchPlaceholder') }}
        filterCount={[params.priority, params.origin, params.complexity, params.customerId, params.assignedEmployeeId].filter(Boolean).length}
        onOpenFilters={() => setFilterOpen(true)}
      >
        <StatusChips
          aria-label={tm('boardSections')}
          value={params.bucket || 'all'}
          onChange={(id) => set({ bucket: id === 'all' ? '' : (id as Exclude<ProductionBucket, 'all'>), page: 1 })}
          items={[{ id: 'all', label: tCommon('all') }, ...PRODUCTION_BUCKETS.map((b) => ({ id: b, label: copy.bucket(b), count: laneCount(b), tone: bucketTone(b) }))]}
        />
      </ListToolbar>

      {params.view === 'boards' ? (
        boards.isError && !boards.data ? (
          <ErrorBoard title={t('production')} description={mutationErrorMessage(boards.error)} onRetry={() => boards.refetch()} />
        ) : boards.isLoading && !boards.data ? (
          <div className="maher-board h-48 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />
        ) : (boards.data?.data ?? []).length === 0 ? (
          <Board tone="neutral">
            <Board.Empty title={tm('emptyTitle')} description={filtered ? tm('emptySearchBody') : tm('emptyBody')} action={filtered ? <Button size="sm" variant="secondary" onClick={reset}>{tCommon('clearFilters')}</Button> : undefined} />
          </Board>
        ) : (
          <ProductionBasketBoard boards={boards.data?.data ?? []} />
        )
      ) : list.isError && !list.data ? (
        <ErrorBoard title={t('production')} description={mutationErrorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<ProductionRow>
          aria-label={tp('orders')}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/production/${r.id}`}
          LinkComponent={Link}
          loading={list.isLoading && !list.data}
          rowClassName={(r) => (r.isLate && r.status !== 'COMPLETED' ? 'bg-[var(--maher-error-soft)]/30' : undefined)}
          mobileRow={(r) => ({
            leading: <RowThumb src={r.imageUrl ?? r.product?.imageUrl} icon={<Armchair className="h-4 w-4" />} />,
            title: title(r),
            meta: `${r.number} · ${stage(r)}`,
            trailing: <Stamp tone={productionTone(r.status)} size="sm">{`${Math.round(Number(r.progressPercent ?? 0))}%`}</Stamp>,
          })}
          empty={<Board.Empty title={tm('emptyTitle')} description={filtered ? tm('emptySearchBody') : tm('emptyBody')} action={filtered ? <Button size="sm" variant="secondary" onClick={reset}>{tCommon('clearFilters')}</Button> : undefined} />}
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
        count={[params.priority, params.origin, params.complexity, params.customerId, params.assignedEmployeeId].filter(Boolean).length}
        onApply={() => setFilterOpen(false)}
        onClear={() => (set({ priority: '', origin: '', complexity: '', customerId: '', assignedEmployeeId: '', page: 1 }), setFilterOpen(false))}
      >
        <div className="space-y-5">
          <DealerCombobox label={tm('filterDealer')} value={params.customerId || null} onChange={(id) => set({ customerId: id ?? '', page: 1 })} />
          <Combobox
            label={tm('assignWorker')}
            value={params.assignedEmployeeId || null}
            onChange={(v) => set({ assignedEmployeeId: v ?? '', page: 1 })}
            options={(workers.data ?? []).map((w) => ({ value: w.id, label: copy.worker(w), description: w.activeTaskCount != null ? tm('activeTasks', { count: w.activeTaskCount }) : undefined }))}
            placeholder={tm('searchWorkers')}
            emptyText={tm('noWorkers')}
            loadingText={tm('loadingWorkers')}
            clearLabel={kit.combobox.clear}
          />
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tm('priorityLabel')}</span>
            <SegmentedControl size="sm" aria-label={tm('priorityLabel')} value={params.priority || 'all'} onChange={(v) => set({ priority: v === 'all' ? '' : (v as Priority), page: 1 })} options={[{ value: 'all', label: tCommon('all') }, ...PRIORITIES.map((p) => ({ value: p, label: copy.priority(p) }))]} />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tm('origin.all')}</span>
            <SegmentedControl
              size="sm"
              aria-label={tm('origin.all')}
              value={params.origin || 'all'}
              onChange={(v) => set({ origin: v === 'all' ? '' : (v as 'normal' | 'returned'), page: 1 })}
              options={[
                { value: 'all', label: tm('origin.all') },
                { value: 'normal', label: tm('origin.normal') },
                { value: 'returned', label: tm('origin.returned') },
              ]}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tSales('desk.complexity')}</span>
            <SegmentedControl size="sm" aria-label={tSales('desk.complexity')} value={params.complexity || 'all'} onChange={(v) => set({ complexity: v === 'all' ? '' : (v as Complexity), page: 1 })} options={[{ value: 'all', label: tCommon('all') }, ...COMPLEXITIES.map((c) => ({ value: c, label: copy.complexity(c) }))]} />
          </div>
        </div>
      </FilterDrawer>

      <ConfirmDialog
        open={Boolean(startRow)}
        title={tp('startConfirmTitle')}
        description={startRow ? `${startRow.number} · ${tp('startConfirmDescription')}` : ''}
        confirmLabel={tp('start')}
        cancelLabel={tCommon('cancel')}
        loading={start.isPending}
        onClose={() => setStartRow(null)}
        onConfirm={() => startRow && start.mutate(startRow.id)}
      />

    </div>
  );
}

export default function ProductionPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <ProductionPageInner />
    </Suspense>
  );
}
