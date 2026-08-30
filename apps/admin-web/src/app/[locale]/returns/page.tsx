'use client';

import { ReturnDetailSheet } from '@/components/returns/return-detail-sheet';
import type { ReturnRow } from '@/components/returns/return-types';
import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import {
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
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Armchair, Camera, Store, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

interface DealerOption {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url}`;
}

function OptionalLink({
  href,
  className,
  children,
}: {
  href: string | null;
  className?: string;
  children: ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function attentionKey(row: ReturnRow): string | null {
  const approval = (row.approvalStatus ?? 'PENDING').toUpperCase();
  const physical = (row.physicalStatus ?? 'NONE').toUpperCase();
  if (approval === 'PENDING') return 'pendingReview';
  if (approval === 'NEED_INFO') return 'needInfo';
  if (approval === 'APPROVED' && physical === 'WAITING_RETURN') return 'waitingReturn';
  if (
    (physical === 'RETURNED' || physical === 'INSPECTING') &&
    (!row.inventoryFate || row.inventoryFate === 'PENDING')
  ) {
    return 'awaitingInspection';
  }
  return null;
}

function ReturnBoardCard({
  row,
  customerLabel,
  reasonLabel,
  physicalLabel,
  attentionLabel,
  dealerOrderLabel,
  openLabel,
  onOpen,
}: {
  row: ReturnRow;
  customerLabel: string;
  reasonLabel: string;
  physicalLabel: string;
  attentionLabel: string | null;
  dealerOrderLabel: string;
  openLabel: string;
  onOpen: () => void;
}) {
  const productSrc = mediaSrc(row.productImageUrl);
  const orderHref = row.salesOrder?.id ? `/sales-orders/${row.salesOrder.id}` : null;
  const dealerNo = row.salesOrder?.externalOrderNumber?.trim() || null;
  const resolution =
    row.inventoryFate && row.inventoryFate !== 'PENDING'
      ? row.inventoryFate
      : row.resolution ?? row.approvalStatus ?? 'PENDING';

  return (
    <article className="maher-list-card group flex flex-col overflow-hidden rounded-xl border border-border bg-[color-mix(in_srgb,var(--maher-surface)_92%,var(--maher-brand)_3%)] shadow-card transition hover:border-brand/40 hover:shadow-elevated">
      <OptionalLink
        href={orderHref}
        className="relative block aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]"
      >
        {productSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={productSrc}
            alt={row.productDesc}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary">
            <Armchair className="h-8 w-8 opacity-40" />
            <Ltr className="text-[10px] font-medium uppercase tracking-wide">{row.number}</Ltr>
          </div>
        )}
        <div className="absolute start-1.5 top-1.5 origin-top-start scale-90">
          <StatusBadge status={row.approvalStatus ?? 'PENDING'} />
        </div>
      </OptionalLink>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <Ltr>{row.number}</Ltr>
            {row.salesOrder?.number ? (
              <>
                <span className="mx-1 text-border">·</span>
                {orderHref ? (
                  <Link
                    href={orderHref}
                    className="text-text-secondary underline-offset-2 hover:text-brand hover:underline"
                  >
                    <Ltr>{row.salesOrder.number}</Ltr>
                  </Link>
                ) : (
                  <Ltr>{row.salesOrder.number}</Ltr>
                )}
              </>
            ) : null}
          </p>
          {dealerNo ? (
            <p className="truncate text-[11px] text-text-secondary">
              <span className="text-text-tertiary">{dealerOrderLabel}: </span>
              <Ltr>{dealerNo}</Ltr>
            </p>
          ) : null}
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">
            {row.productDesc}
          </h2>
          <p className="truncate text-xs text-text-secondary">{customerLabel}</p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-md bg-[var(--maher-surface-muted)] px-1.5 py-0.5 font-medium text-text-secondary">
            {reasonLabel}
          </span>
          <span className="rounded-md bg-[var(--maher-surface-muted)] px-1.5 py-0.5 text-text-tertiary">
            {physicalLabel}
          </span>
          <StatusBadge status={resolution} />
        </div>

        {attentionLabel ? (
          <p className="rounded-md border border-[var(--maher-warning)]/30 bg-[var(--maher-warning-soft)] px-2 py-1 text-[11px] font-medium text-[var(--maher-warning)]">
            {attentionLabel}
          </p>
        ) : null}

        <div className="mt-auto maher-card-rule-t pt-2">
          <Button size="sm" className="w-full" variant="secondary" onClick={onOpen}>
            {openLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function ReturnsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tLife = useTranslations('lifecycle');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const [q, setQ] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<ReturnRow | null>(null);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (dealerId) params.set('customerId', dealerId);
    return params.toString();
  }, [q, dealerId]);

  const dealersQuery = useQuery({
    queryKey: ['customers', 'returns-filter'],
    queryFn: () =>
      apiFetch<{ data: DealerOption[] }>('/api/v1/customers?page=1&pageSize=100'),
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ['returns', listParams],
    queryFn: () =>
      apiFetch<{ data: ReturnRow[] }>(`/api/v1/returns?${listParams}`).then((r) => r.data),
    placeholderData: keepPreviousData,
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

  function reasonLabel(reason: string) {
    try {
      return tc(`returnReason.${reason}` as 'returnReason.OTHER');
    } catch {
      return reason;
    }
  }

  function physicalLabel(status: string | null | undefined) {
    const key = (status ?? 'NONE').toUpperCase();
    try {
      return tLife(`returnPhysical.${key}` as 'returnPhysical.NONE');
    } catch {
      return key;
    }
  }

  function attentionLabel(row: ReturnRow) {
    const key = attentionKey(row);
    if (!key) return null;
    return tLife(`returnAttention.${key}` as 'returnAttention.pendingReview');
  }

  const rows = listQuery.data ?? [];
  const detail =
    (detailId ? rows.find((r) => r.id === detailId) : null) ?? detailRow;
  const initialLoading = listQuery.isLoading && !listQuery.data;

  return (
    <div className="space-y-6">
      <PageHero title={t('returns')} description={tc('returnsDescription')} tone="soft" />

      <div className="maher-animate-rise flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">{tc('returnsSearchPlaceholder')}</span>
          <Input
            withSearchIcon
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc('returnsSearchPlaceholder')}
          />
        </label>

        <div className="relative w-full sm:w-64">
          <div className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2 text-text-tertiary">
            <Store className="h-4 w-4" />
          </div>
          <Select
            aria-label={tc('filterDealer')}
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            placeholder={tc('allDealers')}
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
            {tc('dealerFilterActive', { dealer: selectedDealer.label })}
          </span>
          <button
            type="button"
            onClick={() => setDealerId('')}
            className="ms-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface/70 text-brand transition hover:scale-105 hover:bg-surface active:scale-95"
            aria-label={tc('clearDealerFilter')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {listQuery.isError && !listQuery.data ? (
        <ErrorState
          title={t('returns')}
          onRetry={() => listQuery.refetch()}
          retryLabel={tCommon('retry')}
        />
      ) : initialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={dealerId ? tc('emptyReturnsForDealer') : tc('noReturns')}
          description={tc('returnsEmptyHint')}
          icon={<Camera className="h-6 w-6" />}
        />
      ) : (
        <div
          key={`${dealerId}-${q.trim()}`}
          className={`maher-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
            listQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'
          }`}
        >
          {rows.map((row) => (
            <ReturnBoardCard
              key={row.id}
              row={row}
              customerLabel={
                row.customer ? localizedName(locale, row.customer, row.customer.name) : '—'
              }
              reasonLabel={reasonLabel(row.reason)}
              physicalLabel={physicalLabel(row.physicalStatus)}
              attentionLabel={attentionLabel(row)}
              dealerOrderLabel={tSales('dealerOrderNumber')}
              openLabel={tLife('returnDetail.open')}
              onOpen={() => {
                setDetailId(row.id);
                setDetailRow(row);
              }}
            />
          ))}
        </div>
      )}

      <ReturnDetailSheet
        open={Boolean(detailId)}
        row={detail}
        onClose={() => {
          setDetailId(null);
          setDetailRow(null);
        }}
      />
    </div>
  );
}
