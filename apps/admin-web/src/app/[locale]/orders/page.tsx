'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Ltr,
  MotionSection,
  PageHero,
  Skeleton,
  StatusBadge,
  StaggerGrid,
  cn,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, CheckCircle2, Factory, Package } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

interface SalesOrderRow {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  manufacturingCost?: string | number | null;
  sellerPrice?: string | number | null;
  productionPrice?: string | number | null;
  profit?: string | number | null;
  requiredDeliveryDate?: string | null;
  progressPercent?: number | null;
  title?: string | null;
  imageUrl?: string | null;
  lineCount?: number;
  externalOrderNumber?: string | null;
  productionOrders?: Array<{ id: string; status: string; progressPercent?: number | null }>;
  customer?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
    code?: string;
  };
  quotation?: {
    request?: {
      endCustomerName?: string | null;
      externalOrderNumber?: string | null;
    } | null;
  } | null;
}

interface RequestRow {
  id: string;
  number: string;
  status: string;
  requiredDeliveryDate?: string | null;
  endCustomerName?: string | null;
  externalOrderNumber?: string | null;
  items?: Array<{ productName?: string | null; quantity?: string | number | null }>;
  customer?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
    code?: string;
  };
}

type HubRow =
  | ({ kind: 'sales_order' } & SalesOrderRow)
  | ({ kind: 'rfq' } & RequestRow);

const RFQ_APPROVE_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] as const;

const PRE_PRODUCTION_SO = new Set([
  'DRAFT',
  'CONFIRMED',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
]);

const IN_PRODUCTION_SO = new Set(['IN_PRODUCTION']);

const DONE_SO = new Set(['READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED']);

/** PO statuses that mean factory work has started (or finished on the floor). */
const ACTIVE_PRODUCTION_PO = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
]);

type SectionKey = 'preProduction' | 'inProduction' | 'done';

function hasStartedProduction(row: SalesOrderRow): boolean {
  if (row.progressPercent != null && row.progressPercent > 0) return true;
  return (row.productionOrders ?? []).some((po) => ACTIVE_PRODUCTION_PO.has(po.status));
}

function sectionFor(row: HubRow): SectionKey | null {
  if (row.kind === 'rfq') {
    if (['QUOTED', 'CLOSED', 'CANCELLED'].includes(row.status)) return null;
    return 'preProduction';
  }
  if (row.status === 'CANCELLED') return null;
  // Finished SO statuses win (delivered / completed).
  if (DONE_SO.has(row.status)) return 'done';
  // Explicit IN_PRODUCTION, or any linked PO that has actually started.
  if (IN_PRODUCTION_SO.has(row.status) || hasStartedProduction(row)) return 'inProduction';
  if (PRE_PRODUCTION_SO.has(row.status)) return 'preProduction';
  return 'preProduction';
}

function dealerOrderNumber(row: HubRow) {
  if (row.kind === 'rfq') return row.externalOrderNumber?.trim() || null;
  return (
    row.externalOrderNumber?.trim() ||
    row.quotation?.request?.externalOrderNumber?.trim() ||
    null
  );
}

function OrderCard({
  row,
  dealerLabel,
  endCustomerLabel,
  detailHref,
  title,
  onApprove,
  approveLoading,
  tSales,
  tCatalog,
  tCommon,
}: {
  row: HubRow;
  dealerLabel: string;
  endCustomerLabel: string;
  detailHref: string;
  title: string;
  onApprove?: () => void;
  approveLoading?: boolean;
  tSales: ReturnType<typeof useTranslations>;
  tCatalog: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}) {
  const dealerNo = dealerOrderNumber(row);
  const imageUrl = row.kind === 'sales_order' ? row.imageUrl : null;
  const sellerPrice =
    row.kind === 'sales_order'
      ? Number(row.sellerPrice ?? row.total ?? NaN)
      : Number.NaN;
  const productionPrice =
    row.kind === 'sales_order'
      ? Number(row.productionPrice ?? row.manufacturingCost ?? NaN)
      : Number.NaN;
  const hasSeller = Number.isFinite(sellerPrice);
  const hasProduction = Number.isFinite(productionPrice);
  const progress =
    row.kind === 'sales_order' && row.progressPercent != null ? row.progressPercent : null;

  return (
    <article className="maher-list-card group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <Link
        href={detailHref}
        className="relative block aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary transition duration-300 group-hover:scale-105 group-hover:text-brand/50">
            <Armchair className="h-7 w-7 opacity-40 transition group-hover:opacity-70" />
            <Ltr className="text-[10px] font-medium uppercase tracking-wide">{row.number}</Ltr>
          </div>
        )}
        <div className="absolute start-1.5 top-1.5 origin-top-start scale-90">
          <StatusBadge status={row.status} />
        </div>
        {progress != null ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-5">
            <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium text-white">
              <span>{tSales('progress')}</span>
              <Ltr>{progress}%</Ltr>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="maher-progress-fill h-full rounded-full bg-white"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <span className="font-medium normal-case tracking-normal">{tSales('systemOrderNumber')}: </span>
            <Ltr>{row.number}</Ltr>
          </p>
          {dealerNo ? (
            <p className="truncate text-[11px] text-text-secondary">
              <span className="text-text-tertiary">{tSales('dealerOrderNumber')}: </span>
              <Ltr>{dealerNo}</Ltr>
            </p>
          ) : null}
        </div>
        <Link
          href={detailHref}
          className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary transition-colors hover:text-brand"
        >
          {title}
        </Link>
        <p className="truncate text-xs text-text-secondary">{dealerLabel}</p>
        {endCustomerLabel !== '—' ? (
          <p className="truncate text-[11px] text-text-tertiary">{endCustomerLabel}</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 maher-card-rule-t pt-2">
          <div className="min-w-0 space-y-1.5 text-start">
            <div>
              <p className="text-[10px] text-text-tertiary">{tSales('sellerPrice')}</p>
              <p className="text-sm font-bold tracking-tight text-text-primary">
                <Ltr>
                  {hasSeller ? `${sellerPrice.toFixed(2)} ${tCommon('currency')}` : '—'}
                </Ltr>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary">{tSales('productionPrice')}</p>
              <p className="text-xs font-semibold text-text-secondary">
                <Ltr>
                  {hasProduction ? `${productionPrice.toFixed(2)} ${tCommon('currency')}` : '—'}
                </Ltr>
              </p>
            </div>
            {row.requiredDeliveryDate ? (
              <p className="truncate text-[10px] text-text-tertiary">
                <Ltr>{row.requiredDeliveryDate.slice(0, 10)}</Ltr>
              </p>
            ) : null}
          </div>

          <div className="shrink-0">
            {row.kind === 'rfq' &&
            RFQ_APPROVE_STATUSES.includes(row.status as (typeof RFQ_APPROVE_STATUSES)[number]) ? (
              <Button size="sm" className="maher-sheen" loading={approveLoading} onClick={onApprove}>
                {tCatalog('approve')}
              </Button>
            ) : row.kind === 'sales_order' && row.status === 'DRAFT' ? (
              <Link href={`/sales-orders/${row.id}`}>
                <Button size="sm" variant="secondary" className="maher-sheen">
                  {tSales('confirm')}
                </Button>
              </Link>
            ) : (
              <Link href={detailHref}>
                <Button size="sm" variant="ghost">
                  {tCommon('details')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function OrdersHubPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tCatalog = useTranslations('catalog');
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('preProduction');

  const salesOrdersQuery = useQuery({
    queryKey: ['orders-hub-sales-orders'],
    queryFn: () =>
      apiFetch<{ data: SalesOrderRow[] }>('/api/v1/sales-orders?pageSize=100').then(
        (r) => r.data ?? [],
      ),
  });

  const requestsQuery = useQuery({
    queryKey: ['orders-hub-requests'],
    queryFn: () =>
      apiFetch<{ data: RequestRow[] }>('/api/v1/requests?pageSize=100').then((r) => r.data ?? []),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/requests/${id}/ready-for-quotation`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setBanner(tCatalog('rfqApproved'));
      await queryClient.invalidateQueries({ queryKey: ['orders-hub-requests'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const rows = useMemo<HubRow[]>(() => {
    const salesOrders: HubRow[] = (salesOrdersQuery.data ?? []).map((row) => ({
      kind: 'sales_order',
      ...row,
    }));
    const rfqs: HubRow[] = (requestsQuery.data ?? [])
      .filter((r) => !['QUOTED', 'CLOSED', 'CANCELLED'].includes(r.status))
      .map((row) => ({ kind: 'rfq', ...row }));
    return [...rfqs, ...salesOrders];
  }, [salesOrdersQuery.data, requestsQuery.data]);

  const sections = useMemo(() => {
    const preProduction: HubRow[] = [];
    const inProduction: HubRow[] = [];
    const done: HubRow[] = [];
    for (const row of rows) {
      const key = sectionFor(row);
      if (key === 'preProduction') preProduction.push(row);
      else if (key === 'inProduction') inProduction.push(row);
      else if (key === 'done') done.push(row);
    }
    return { preProduction, inProduction, done };
  }, [rows]);

  const tabs: Array<{
    key: SectionKey;
    label: string;
    hint: string;
    count: number;
    icon: ReactNode;
    activeClass: string;
  }> = [
    {
      key: 'preProduction',
      label: tSales('sectionPreProduction'),
      hint: tSales('sectionPreProductionHint'),
      count: sections.preProduction.length,
      icon: <Package className="h-4 w-4" />,
      activeClass: 'border-brand bg-[var(--maher-brand-soft)] text-brand',
    },
    {
      key: 'inProduction',
      label: tSales('sectionInProduction'),
      hint: tSales('sectionInProductionHint'),
      count: sections.inProduction.length,
      icon: <Factory className="h-4 w-4" />,
      activeClass: 'border-[var(--maher-warning)] bg-[var(--maher-warning-soft)] text-[var(--maher-warning)]',
    },
    {
      key: 'done',
      label: tSales('sectionDone'),
      hint: tSales('sectionDoneHint'),
      count: sections.done.length,
      icon: <CheckCircle2 className="h-4 w-4" />,
      activeClass: 'border-[var(--maher-success)] bg-[var(--maher-success-soft)] text-[var(--maher-success)]',
    },
  ];

  const activeRows = sections[activeSection];
  const activeTab = tabs.find((tab) => tab.key === activeSection) ?? tabs[0]!;

  const isLoading = salesOrdersQuery.isLoading || requestsQuery.isLoading;
  const isError = salesOrdersQuery.isError || requestsQuery.isError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-40 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t('ordersOverview')}
        onRetry={() => {
          void salesOrdersQuery.refetch();
          void requestsQuery.refetch();
        }}
        retryLabel={tCommon('retry')}
      />
    );
  }

  function dealerLabel(row: HubRow) {
    const customer = row.customer;
    return customer ? localizedName(locale, customer, customer.name) : '—';
  }

  function endCustomerLabel(row: HubRow) {
    if (row.kind === 'rfq') {
      return row.endCustomerName ?? '—';
    }
    return row.quotation?.request?.endCustomerName ?? '—';
  }

  function detailHref(row: HubRow) {
    return row.kind === 'rfq' ? `/requests/${row.id}` : `/sales-orders/${row.id}`;
  }

  function orderTitle(row: HubRow) {
    if (row.kind === 'sales_order') {
      return row.title?.trim() || row.number;
    }
    const first = row.items?.[0]?.productName?.trim();
    if (first) {
      const extra = (row.items?.length ?? 0) > 1 ? ` +${(row.items?.length ?? 1) - 1}` : '';
      return `${first}${extra}`;
    }
    return row.number;
  }

  return (
    <div className="space-y-6">
      <PageHero title={t('ordersOverview')} description={tCommon('ordersSubtitle')} tone="soft" />

      {banner ? (
        <MotionSection enter="drop" className="maher-animate-bounce-in">
          <Alert variant="success">{banner}</Alert>
        </MotionSection>
      ) : null}
      {error ? (
        <MotionSection enter="drop">
          <Alert variant="error">{error}</Alert>
        </MotionSection>
      ) : null}

      <MotionSection delayMs={40} className="space-y-2">
        <div
          role="tablist"
          aria-label={t('ordersOverview')}
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
                onClick={() => setActiveSection(tab.key)}
                className={cn(
                  'maher-filter-chip maher-press inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium',
                  selected
                    ? tab.activeClass
                    : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary',
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'maher-filter-chip__count rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                    selected ? 'bg-surface/70 text-inherit' : 'bg-[var(--maher-surface-muted)]',
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        <p key={activeSection} className="maher-animate-fade text-sm text-text-secondary">
          {activeTab.hint}
        </p>
      </MotionSection>

      {activeRows.length === 0 ? (
        <div key={`empty-${activeSection}`} className="maher-panel-swap">
          <EmptyState title={tSales('sectionEmpty')} />
        </div>
      ) : (
        <StaggerGrid
          key={activeSection}
          className="maher-panel-swap grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        >
          {activeRows.map((row) => (
            <OrderCard
              key={`${row.kind}-${row.id}`}
              row={row}
              dealerLabel={dealerLabel(row)}
              endCustomerLabel={endCustomerLabel(row)}
              detailHref={detailHref(row)}
              title={orderTitle(row)}
              onApprove={row.kind === 'rfq' ? () => approveMutation.mutate(row.id) : undefined}
              approveLoading={approveMutation.isPending}
              tSales={tSales}
              tCatalog={tCatalog}
              tCommon={tCommon}
            />
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}
