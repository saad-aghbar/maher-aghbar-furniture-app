'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Ltr,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Armchair,
  CheckCircle2,
  Factory,
  ListOrdered,
  Store,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';

interface DealerOption {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

interface ProductionRow {
  id: string;
  number: string;
  productDescription: string;
  status: string;
  progressPercent: number;
  currentStageCode?: string | null;
  requiredDeliveryDate?: string | null;
  plannedCompletionDate?: string | null;
  actualCompletionDate?: string | null;
  imageUrl?: string | null;
  customerId?: string | null;
  customer?: DealerOption | null;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  product?: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr?: string | null;
    nameHe?: string | null;
    imageUrl?: string | null;
  } | null;
  currentStage?: {
    code: string;
    nameEn: string;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
}

type SectionKey = 'completedToday' | 'late' | 'inProduction' | 'inQueue';

const QUEUE_STATUSES = new Set(['DRAFT', 'PLANNED', 'WAITING_FOR_MATERIALS', 'READY']);
const IN_PRODUCTION_STATUSES = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
]);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function isCompletedToday(row: ProductionRow) {
  if (row.status !== 'COMPLETED') return false;
  if (!row.actualCompletionDate) return false;
  const at = new Date(row.actualCompletionDate);
  return at >= startOfToday() && at <= endOfToday();
}

function isLate(row: ProductionRow) {
  if (row.status === 'COMPLETED' || row.status === 'CANCELLED') return false;
  const now = new Date();
  const delivery = row.requiredDeliveryDate ? new Date(row.requiredDeliveryDate) : null;
  const planned = row.plannedCompletionDate ? new Date(row.plannedCompletionDate) : null;
  if (delivery && delivery < now) return true;
  if (planned && planned < endOfToday()) return true;
  return false;
}

function sectionFor(row: ProductionRow): SectionKey | null {
  if (row.status === 'CANCELLED') return null;
  if (row.status === 'COMPLETED') return isCompletedToday(row) ? 'completedToday' : null;
  if (isLate(row)) return 'late';
  if (IN_PRODUCTION_STATUSES.has(row.status)) return 'inProduction';
  if (QUEUE_STATUSES.has(row.status)) return 'inQueue';
  return 'inProduction';
}

function ProductionCard({
  row,
  productTitle,
  stageLabel,
  systemOrderLabel,
  dealerOrderLabel,
  dealerName,
  canStart,
  onStart,
  startLabel,
}: {
  row: ProductionRow;
  productTitle: string;
  stageLabel: string;
  systemOrderLabel: string;
  dealerOrderLabel: string;
  dealerName?: string | null;
  canStart: boolean;
  onStart: () => void;
  startLabel: string;
}) {
  const imageUrl = row.imageUrl ?? row.product?.imageUrl ?? null;
  const pct = Math.min(100, Math.max(0, Number(row.progressPercent ?? 0)));
  const href = `/production/${row.id}`;
  const systemNo = row.salesOrder?.number ?? null;
  const dealerNo = row.salesOrder?.externalOrderNumber?.trim() || null;

  return (
    <article className="maher-list-card group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-brand/40 hover:shadow-sm">
      <Link
        href={href}
        className="relative block aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={productTitle}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary">
            <Armchair className="h-7 w-7 opacity-40" />
            <Ltr className="text-[10px] font-medium uppercase tracking-wide">{row.number}</Ltr>
          </div>
        )}
        <div className="absolute start-1.5 top-1.5 origin-top-start scale-90">
          <StatusBadge status={row.status} />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-[var(--maher-brand)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <Ltr className="shrink-0 text-[11px] font-semibold text-white">{pct}%</Ltr>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="space-y-0.5">
          <Ltr className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            {row.number}
          </Ltr>
          {systemNo ? (
            <p className="truncate text-[11px] text-text-secondary">
              <span className="text-text-tertiary">{systemOrderLabel}: </span>
              <Ltr>{systemNo}</Ltr>
            </p>
          ) : null}
          {dealerNo ? (
            <p className="truncate text-[11px] text-text-secondary">
              <span className="text-text-tertiary">{dealerOrderLabel}: </span>
              <Ltr>{dealerNo}</Ltr>
            </p>
          ) : null}
          {dealerName ? (
            <p className="truncate text-[11px] font-medium text-text-secondary">{dealerName}</p>
          ) : null}
        </div>
        <Link
          href={href}
          className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary hover:text-brand"
        >
          {productTitle}
        </Link>
        <p className="truncate text-[11px] text-text-tertiary">{stageLabel}</p>

        {canStart ? (
          <div className="mt-auto maher-card-rule-t pt-2">
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStart();
              }}
            >
              {startLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ProductionPageInner() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [q, setQ] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startId, setStartId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>(() => {
    const fromUrl = searchParams.get('section');
    if (
      fromUrl === 'completedToday' ||
      fromUrl === 'late' ||
      fromUrl === 'inProduction' ||
      fromUrl === 'inQueue'
    ) {
      return fromUrl;
    }
    if (searchParams.get('status') === 'IN_PROGRESS') return 'inProduction';
    return 'inProduction';
  });

  useEffect(() => {
    const fromUrl = searchParams.get('section');
    if (
      fromUrl === 'completedToday' ||
      fromUrl === 'late' ||
      fromUrl === 'inProduction' ||
      fromUrl === 'inQueue'
    ) {
      setActiveSection(fromUrl);
    }
  }, [searchParams]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (dealerId) params.set('customerId', dealerId);
    return params.toString();
  }, [q, dealerId]);

  const dealersQuery = useQuery({
    queryKey: ['customers', 'production-filter'],
    queryFn: () =>
      apiFetch<{ data: DealerOption[] }>('/api/v1/customers?page=1&pageSize=100'),
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ['production-orders', listParams],
    queryFn: () =>
      apiFetch<{ data: ProductionRow[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/production-orders?${listParams}`,
      ),
    placeholderData: keepPreviousData,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/production-orders/${id}/start`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setStartId(null);
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      setBanner(tc('productionStarted'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const dealerOptions = useMemo(() => {
    const rows = dealersQuery.data?.data ?? [];
    return rows
      .map((d) => ({
        value: d.id,
        label: localizedName(locale, d, d.name) || d.name || d.code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [dealersQuery.data?.data, locale]);

  const selectedDealer = useMemo(
    () => dealerOptions.find((d) => d.value === dealerId) ?? null,
    [dealerOptions, dealerId],
  );

  const sections = useMemo(() => {
    const buckets: Record<SectionKey, ProductionRow[]> = {
      completedToday: [],
      late: [],
      inProduction: [],
      inQueue: [],
    };
    for (const row of listQuery.data?.data ?? []) {
      const key = sectionFor(row);
      if (key) buckets[key].push(row);
    }
    return buckets;
  }, [listQuery.data?.data]);

  const tabs: Array<{
    key: SectionKey;
    label: string;
    hint: string;
    count: number;
    icon: ReactNode;
    activeClass: string;
  }> = [
    {
      key: 'completedToday',
      label: tp('completedToday'),
      hint: tp('sectionCompletedTodayHint'),
      count: sections.completedToday.length,
      icon: <CheckCircle2 className="h-4 w-4" />,
      activeClass:
        'border-[var(--maher-success)] bg-[var(--maher-success-soft)] text-[var(--maher-success)]',
    },
    {
      key: 'late',
      label: tp('lateOrders'),
      hint: tp('sectionLateHint'),
      count: sections.late.length,
      icon: <AlertTriangle className="h-4 w-4" />,
      activeClass: 'border-brand bg-[var(--maher-brand-soft)] text-brand',
    },
    {
      key: 'inProduction',
      label: tp('inProduction'),
      hint: tp('sectionInProductionHint'),
      count: sections.inProduction.length,
      icon: <Factory className="h-4 w-4" />,
      activeClass:
        'border-[var(--maher-warning)] bg-[var(--maher-warning-soft)] text-[var(--maher-warning)]',
    },
    {
      key: 'inQueue',
      label: tp('inQueue'),
      hint: tp('sectionInQueueHint'),
      count: sections.inQueue.length,
      icon: <ListOrdered className="h-4 w-4" />,
      activeClass: 'border-brand bg-[var(--maher-brand-soft)] text-brand',
    },
  ];

  const activeRows = sections[activeSection];
  const activeTab = tabs.find((tab) => tab.key === activeSection) ?? tabs[2]!;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = activeRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const initialLoading = listQuery.isLoading && !listQuery.data;

  function productTitle(row: ProductionRow) {
    if (row.product) return localizedName(locale, row.product, row.product.nameEn);
    return row.productDescription || row.number;
  }

  function stageLabel(row: ProductionRow) {
    if (row.currentStage) {
      return `${tp('stage')}: ${localizedName(locale, row.currentStage, row.currentStage.nameEn)}`;
    }
    if (row.currentStageCode) return `${tp('stage')}: ${row.currentStageCode}`;
    return `${tp('stage')}: —`;
  }

  function dealerName(row: ProductionRow) {
    if (!row.customer) return null;
    return localizedName(locale, row.customer, row.customer.name) || row.customer.name;
  }

  return (
    <div className="space-y-6">
      <PageHero title={t('production')} description={tp('orders')} tone="soft" />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error && !startId ? <Alert variant="error">{error}</Alert> : null}

      <div
        role="tablist"
        aria-label={t('production')}
        className="maher-stagger flex flex-wrap gap-2"
      >
        {tabs.map((tab) => {
          const selected = tab.key === activeSection;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActiveSection(tab.key);
                setPage(1);
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                selected
                  ? tab.activeClass
                  : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  selected ? 'bg-surface/70 text-inherit' : 'bg-[var(--maher-surface-muted)]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-text-secondary">{activeTab.hint}</p>

      <div className="maher-animate-rise flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">{tp('searchPlaceholder')}</span>
          <Input
            withSearchIcon
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={tp('searchPlaceholder')}
          />
        </label>

        <div className="relative w-full sm:w-64">
          <div className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2 text-text-tertiary">
            <Store className="h-4 w-4" />
          </div>
          <Select
            aria-label={tp('filterDealer')}
            value={dealerId}
            onChange={(e) => {
              setPage(1);
              setDealerId(e.target.value);
            }}
            placeholder={tp('allDealers')}
            options={dealerOptions}
            className="ps-9 transition-shadow duration-300 focus:shadow-[0_0_0_4px_var(--maher-brand-soft)]"
            disabled={dealersQuery.isLoading}
          />
        </div>
      </div>

      {selectedDealer ? (
        <div className="maher-animate-bounce-in inline-flex max-w-full items-center gap-2 rounded-full border border-brand/25 bg-[var(--maher-brand-soft)] px-3 py-1.5 text-sm text-brand">
          <Store className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {tp('dealerFilterActive', { dealer: selectedDealer.label })}
          </span>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setDealerId('');
            }}
            className="ms-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface/70 text-brand transition hover:scale-105 hover:bg-surface active:scale-95"
            aria-label={tp('clearDealerFilter')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {listQuery.isError && !listQuery.data ? (
        <ErrorState
          title={t('production')}
          onRetry={() => listQuery.refetch()}
          retryLabel={tCommon('retry')}
        />
      ) : initialLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : pageRows.length === 0 ? (
        <EmptyState
          title={dealerId ? tp('emptyOrdersForDealer') : tp('emptyOrders')}
          description={activeTab.hint}
        />
      ) : (
        <div
          key={`${activeSection}-${dealerId}-${q.trim()}`}
          className={`space-y-3 ${listQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}`}
        >
          <div className="maher-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pageRows.map((row) => {
              const canStart =
                row.status === 'DRAFT' ||
                row.status === 'PLANNED' ||
                row.status === 'READY' ||
                row.status === 'WAITING_FOR_MATERIALS';
              return (
                <ProductionCard
                  key={row.id}
                  row={row}
                  productTitle={productTitle(row)}
                  stageLabel={stageLabel(row)}
                  systemOrderLabel={tSales('systemOrderNumber')}
                  dealerOrderLabel={tSales('dealerOrderNumber')}
                  dealerName={dealerName(row)}
                  canStart={canStart}
                  onStart={() => {
                    setError(null);
                    setStartId(row.id);
                  }}
                  startLabel={tp('start')}
                />
              );
            })}
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {tCommon('previous')}
              </Button>
              <span className="text-sm text-text-secondary tabular-nums" dir="ltr">
                {safePage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {tCommon('next')}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(startId)}
        title={tp('startConfirmTitle')}
        description={tp('startConfirmDescription')}
        confirmLabel={tp('start')}
        loading={startMutation.isPending}
        error={error}
        onConfirm={() => {
          if (startId) startMutation.mutate(startId);
        }}
        onClose={() => {
          setStartId(null);
          setError(null);
        }}
      />
    </div>
  );
}

export default function ProductionPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ProductionPageInner />
    </Suspense>
  );
}
