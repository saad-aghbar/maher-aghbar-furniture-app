'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
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
import { Armchair, Camera, ImageOff, Store, X } from 'lucide-react';
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

interface ReturnRow {
  id: string;
  number: string;
  productDesc: string;
  quantity: string | number;
  reason: string;
  description?: string | null;
  approvalStatus?: string;
  productImageUrl?: string | null;
  reasonPhotoUrl?: string | null;
  issuePhotoUrl?: string | null;
  customer?: {
    id?: string;
    code?: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url}`;
}

function PhotoThumb({
  src,
  label,
  emptyLabel,
}: {
  src: string | null;
  label: string;
  emptyLabel: string;
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-text-tertiary">
          <ImageOff className="h-4 w-4 opacity-50" />
          <span className="text-center text-[10px] leading-tight">{emptyLabel}</span>
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-medium text-white">
        {label}
      </span>
    </div>
  );
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

function ReturnCard({
  row,
  customerLabel,
  reasonLabel,
  productPhotoLabel,
  reasonPhotoLabel,
  issuePhotoLabel,
  noPhotoLabel,
  dealerOrderLabel,
  resolving,
  resolvingAction,
  onApprove,
  onReject,
  tCommon,
  tc,
}: {
  row: ReturnRow;
  customerLabel: string;
  reasonLabel: string;
  productPhotoLabel: string;
  reasonPhotoLabel: string;
  issuePhotoLabel: string;
  noPhotoLabel: string;
  dealerOrderLabel: string;
  resolving: boolean;
  resolvingAction: 'APPROVED' | 'REJECTED' | null;
  onApprove: () => void;
  onReject: () => void;
  tCommon: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const pending = (row.approvalStatus ?? 'PENDING') === 'PENDING';
  const productSrc = mediaSrc(row.productImageUrl);
  const reasonSrc = mediaSrc(row.reasonPhotoUrl);
  const issueSrc = mediaSrc(row.issuePhotoUrl);
  const orderHref = row.salesOrder?.id ? `/sales-orders/${row.salesOrder.id}` : null;
  const dealerNo = row.salesOrder?.externalOrderNumber?.trim() || null;

  return (
    <article className="maher-list-card group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-brand/40 hover:shadow-sm">
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
        <span className="absolute end-1.5 top-1.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {productPhotoLabel}
        </span>
      </OptionalLink>

      <div className="grid grid-cols-2 gap-1.5 p-2.5 pb-0">
        <PhotoThumb src={reasonSrc} label={reasonPhotoLabel} emptyLabel={noPhotoLabel} />
        <PhotoThumb src={issueSrc} label={issuePhotoLabel} emptyLabel={noPhotoLabel} />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <Ltr>{row.number}</Ltr>
            {row.salesOrder?.number && orderHref ? (
              <>
                <span className="mx-1 text-border">·</span>
                <Link
                  href={orderHref}
                  className="text-text-secondary underline-offset-2 hover:text-brand hover:underline"
                >
                  <Ltr>{row.salesOrder.number}</Ltr>
                </Link>
              </>
            ) : row.salesOrder?.number ? (
              <>
                <span className="mx-1 text-border">·</span>
                <Ltr>{row.salesOrder.number}</Ltr>
              </>
            ) : null}
          </p>
          {dealerNo ? (
            <p className="truncate text-[11px] text-text-secondary">
              <span className="text-text-tertiary">{dealerOrderLabel}: </span>
              <Ltr>{dealerNo}</Ltr>
            </p>
          ) : null}
          {orderHref ? (
            <Link
              href={orderHref}
              className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary hover:text-brand"
            >
              {row.productDesc}
            </Link>
          ) : (
            <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">
              {row.productDesc}
            </h2>
          )}
          <p className="truncate text-xs text-text-secondary">{customerLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-tertiary">
          <span className="font-medium text-text-secondary">{reasonLabel}</span>
          <span aria-hidden="true">·</span>
          <span>
            {tc('qty')}: <Ltr>{Number(row.quantity)}</Ltr>
          </span>
        </div>

        {row.description ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-text-secondary">
            {row.description}
          </p>
        ) : null}

        <div className="mt-auto maher-card-rule-t pt-2">
          {pending ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="flex-1"
                loading={resolving && resolvingAction === 'APPROVED'}
                disabled={resolving}
                onClick={onApprove}
              >
                {tCommon('approve')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                loading={resolving && resolvingAction === 'REJECTED'}
                disabled={resolving}
                onClick={onReject}
              >
                {tCommon('reject')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-tertiary">{tCommon('status')}</span>
              <StatusBadge status={row.approvalStatus ?? 'PENDING'} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ReturnsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvingAction, setResolvingAction] = useState<'APPROVED' | 'REJECTED' | null>(null);

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

  const resolveMutation = useMutation({
    mutationFn: ({
      id,
      approvalStatus,
    }: {
      id: string;
      approvalStatus: 'APPROVED' | 'REJECTED';
    }) =>
      apiFetch(`/api/v1/returns/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus }),
      }),
    onMutate: ({ id, approvalStatus }) => {
      setResolvingId(id);
      setResolvingAction(approvalStatus);
    },
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['returns'] });
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
    onSettled: () => {
      setResolvingId(null);
      setResolvingAction(null);
    },
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

  const rows = listQuery.data ?? [];
  const initialLoading = listQuery.isLoading && !listQuery.data;

  return (
    <div className="space-y-6">
      <PageHero title={t('returns')} description={tc('returnsDescription')} tone="soft" />
      {actionError ? <Alert variant="error">{actionError}</Alert> : null}

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
            <ReturnCard
              key={row.id}
              row={row}
              customerLabel={
                row.customer ? localizedName(locale, row.customer, row.customer.name) : '—'
              }
              reasonLabel={reasonLabel(row.reason)}
              productPhotoLabel={tc('productPhoto')}
              reasonPhotoLabel={tc('reasonPhoto')}
              issuePhotoLabel={tc('issuePhoto')}
              noPhotoLabel={tc('noReturnPhoto')}
              dealerOrderLabel={tSales('dealerOrderNumber')}
              resolving={resolvingId === row.id}
              resolvingAction={resolvingId === row.id ? resolvingAction : null}
              onApprove={() =>
                resolveMutation.mutate({ id: row.id, approvalStatus: 'APPROVED' })
              }
              onReject={() =>
                resolveMutation.mutate({ id: row.id, approvalStatus: 'REJECTED' })
              }
              tCommon={tCommon}
              tc={tc}
            />
          ))}
        </div>
      )}
    </div>
  );
}
