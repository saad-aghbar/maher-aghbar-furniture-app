'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import {
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
import { useQuery } from '@tanstack/react-query';
import { Armchair, CheckCircle2, Factory, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

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

type SectionKey = 'preProduction' | 'inProduction' | 'done';

type HubRow =
  | (RequestRow & { kind: 'rfq' })
  | (SalesOrderRow & { kind: 'sales_order' });

const DONE_SO = new Set(['DELIVERED', 'COMPLETED', 'CLOSED']);
const IN_PRODUCTION_SO = new Set(['IN_PRODUCTION', 'READY_FOR_DELIVERY']);
const PRE_PRODUCTION_SO = new Set(['DRAFT', 'CONFIRMED', 'ON_HOLD']);

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function hasStartedProduction(row: SalesOrderRow) {
  return (row.productionOrders ?? []).some(
    (po) =>
      (po.progressPercent ?? 0) > 0 ||
      (po.currentStageCode && po.currentStageCode !== 'PENDING') ||
      (po.status && !['DRAFT', 'PENDING', 'PLANNED'].includes(po.status)),
  );
}

function sectionFor(row: HubRow): SectionKey | null {
  if (row.kind === 'rfq') {
    if (['QUOTED', 'CLOSED', 'CANCELLED'].includes(row.status)) return null;
    return 'preProduction';
  }
  if (row.status === 'CANCELLED') return null;
  if (DONE_SO.has(row.status)) return 'done';
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
  tCommon,
}: {
  row: HubRow;
  detailHref: string;
  title: string;
  imageUrl: string | null;
  tSales: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}) {
  const dealerNo = dealerOrderNumber(row);
  const progress =
    row.kind === 'sales_order' && row.progressPercent != null ? row.progressPercent : null;
  const rawEnd = row.kind === 'rfq' ? row.endCustomerName?.trim() : null;
  const endCustomer =
    rawEnd && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawEnd)
      ? rawEnd
      : null;

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
            className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-text-tertiary transition duration-300 group-hover:scale-105 group-hover:text-brand/50">
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
            <div className="h-1.5 overflow-hidden rounded-full bg-white/35">
              <div
                className="maher-progress-fill h-full rounded-full bg-[var(--maher-brand)]"
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
        {endCustomer ? (
          <p className="truncate text-[11px] text-text-tertiary">{endCustomer}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-end maher-card-rule-t pt-2">
          <Link href={detailHref}>
            <Button size="sm" variant="ghost">
              {tCommon('details')}
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const t = useTranslations('sales');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const [section, setSection] = useState<SectionKey>('preProduction');

  const requestsQuery = useQuery({
    queryKey: ['customer-requests'],
    queryFn: async () => {
      const json = await apiFetch<{ data?: RequestRow[] } | RequestRow[]>(
        '/api/v1/requests?pageSize=50',
      );
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  const salesOrdersQuery = useQuery({
    queryKey: ['customer-orders'],
    queryFn: async () => {
      const json = await apiFetch<{ data?: SalesOrderRow[] } | SalesOrderRow[]>(
        '/api/v1/sales-orders?pageSize=50',
      );
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  const rows = useMemo<HubRow[]>(() => {
    const salesOrders: HubRow[] = (salesOrdersQuery.data ?? []).map((row) => ({
      kind: 'sales_order' as const,
      ...row,
    }));
    const rfqs: HubRow[] = (requestsQuery.data ?? [])
      .filter((r) => !['QUOTED', 'CLOSED', 'CANCELLED'].includes(r.status))
      .map((row) => ({ kind: 'rfq' as const, ...row }));
    return [...rfqs, ...salesOrders];
  }, [salesOrdersQuery.data, requestsQuery.data]);

  const rfqPreviewDocIds = useMemo(() => {
    const ids: string[] = [];
    for (const row of requestsQuery.data ?? []) {
      const doc = firstImageDoc(row.documents);
      if (doc) ids.push(doc.id);
    }
    return ids;
  }, [requestsQuery.data]);

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
    // Prefer catalog product image; uploads only when no catalog image (custom orders)
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
      label: t('sectionPreProduction'),
      hint: t('sectionPreProductionHint'),
      count: sections.preProduction.length,
      icon: <Package className="h-4 w-4" />,
      activeClass: 'border-brand bg-[var(--maher-brand-soft)] text-brand',
    },
    {
      key: 'inProduction',
      label: t('sectionInProduction'),
      hint: t('sectionInProductionHint'),
      count: sections.inProduction.length,
      icon: <Factory className="h-4 w-4" />,
      activeClass: 'border-brand bg-[var(--maher-brand-soft)] text-brand',
    },
    {
      key: 'done',
      label: t('sectionDone'),
      hint: t('sectionDoneHint'),
      count: sections.done.length,
      icon: <CheckCircle2 className="h-4 w-4" />,
      activeClass: 'border-brand bg-[var(--maher-brand-soft)] text-brand',
    },
  ];

  const isLoading = requestsQuery.isLoading || salesOrdersQuery.isLoading;
  const isError = requestsQuery.isError || salesOrdersQuery.isError;
  const activeRows = sections[section];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
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

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={tNav('myOrders')} description={tCommon('ordersSubtitle')} />

      <MotionSection delayMs={40} className="space-y-2">
        <div className="maher-stagger flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={section === tab.key}
              onClick={() => setSection(tab.key)}
              className={cn(
                'maher-filter-chip maher-press inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium',
                section === tab.key
                  ? tab.activeClass
                  : 'border-border bg-surface text-text-secondary hover:border-brand/30 hover:text-text-primary',
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <Ltr className="maher-filter-chip__count rounded-full bg-black/5 px-1.5 text-xs tabular-nums">
                {tab.count}
              </Ltr>
            </button>
          ))}
        </div>
        <p key={section} className="maher-animate-fade text-xs text-text-tertiary">
          {tabs.find((t) => t.key === section)?.hint}
        </p>
      </MotionSection>

      {activeRows.length === 0 ? (
        <div key={`empty-${section}`} className="maher-panel-swap">
          <EmptyState title={t('empty')} description={tc('noOrdersYetHint')} />
        </div>
      ) : (
        <StaggerGrid
          key={section}
          className="maher-panel-swap grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        >
          {activeRows.map((row) => (
            <OrderCard
              key={`${row.kind}-${row.id}`}
              row={row}
              title={orderTitle(row)}
              imageUrl={cardImageUrl(row)}
              detailHref={
                row.kind === 'rfq' ? `/orders/requests/${row.id}` : `/orders/${row.id}`
              }
              tSales={t}
              tCommon={tCommon}
            />
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}
