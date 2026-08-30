'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Ltr,
  MotionSection,
  PageHero,
  Select,
  Skeleton,
  cn,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface PaymentCustomer {
  id: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  code?: string | null;
}

interface PaymentRow {
  id: string;
  number: string;
  amount: string | number;
  method: string;
  paymentDate: string;
  referenceNumber?: string | null;
  customerId?: string;
  customer?: PaymentCustomer | null;
  invoiceId?: string | null;
  invoice?: { id: string; number: string } | null;
  allocatedAmount?: string | number | null;
  unallocatedAmount?: string | number | null;
}

interface CustomerOption {
  id: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

function money(value: string | number | undefined | null, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

function PaymentsPageInner() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const ta = useTranslations('accounting');
  const tCommon = useTranslations('common');
  const currency = tCommon('currency');

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (debouncedQ) params.set('q', debouncedQ);
    if (customerId) params.set('customerId', customerId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString();
  }, [debouncedQ, customerId, dateFrom, dateTo, page]);

  const listQuery = useQuery({
    queryKey: ['payments', listParams],
    queryFn: () =>
      apiFetch<{ data: PaymentRow[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/payments?${listParams}`,
      ),
    placeholderData: keepPreviousData,
  });

  const customersQuery = useQuery({
    queryKey: ['customers-payment-filter'],
    queryFn: () =>
      apiFetch<{ data: CustomerOption[] }>('/api/v1/customers?pageSize=100').then((r) => r.data),
  });

  const customers = customersQuery.data ?? [];
  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  const customerOptions = [
    { value: '', label: ta('allCustomers') },
    ...customers.map((c) => ({
      value: c.id,
      label: localizedName(locale, c, c.name),
    })),
  ];

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (listQuery.isError && !listQuery.data) {
    return (
      <ErrorState
        title={t('payments')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHero title={t('payments')} description={ta('paymentsEmptyHint')} />

      <MotionSection className="maher-form-section" as="div">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label={ta('searchPayments')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={ta('searchPayments')}
          />
          <Select
            label={ta('paymentDealer')}
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setPage(1);
            }}
            options={customerOptions}
          />
          <Input
            label={ta('filterDateFrom')}
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label={ta('filterDateTo')}
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </MotionSection>

      {rows.length === 0 ? (
        <EmptyState title={ta('paymentsEmpty')} description={ta('paymentsEmptyHint')} />
      ) : (
        <div className="maher-stagger space-y-3">
          {rows.map((p) => {
            const dealer =
              p.customer != null
                ? localizedName(locale, p.customer, p.customer.name ?? '—')
                : '—';
            const unallocated = Number(p.unallocatedAmount ?? 0);
            return (
              <div
                key={p.id}
                className={cn(
                  'maher-list-card rounded-2xl border border-border bg-surface px-5 py-4',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold tracking-tight" dir="ltr">
                      {p.number}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {dealer}
                      {p.invoice?.number ? (
                        <>
                          {' · '}
                          <Link
                            href={`/invoices/${p.invoice.id}`}
                            className="text-brand hover:underline"
                          >
                            {p.invoice.number}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <p className="text-xs text-text-tertiary" dir="ltr">
                      {p.paymentDate?.slice(0, 10) ?? '—'} ·{' '}
                      {ta(`method${p.method}` as 'methodCASH')}
                      {p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
                    </p>
                  </div>
                  <div className="text-end space-y-1">
                    <p className="text-lg font-semibold tabular-nums" dir="ltr">
                      {money(p.amount, currency)}
                    </p>
                    <p className="text-xs text-text-secondary" dir="ltr">
                      {ta('unallocatedCredit')}: {money(unallocated, currency)}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        window.open(`${API_URL}/api/v1/payments/${p.id}/pdf`, '_blank');
                      }}
                    >
                      {ta('downloadPdf')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {tCommon('previous')}
          </Button>
          <Ltr className="text-sm text-text-secondary">
            {meta.page} / {meta.totalPages}
          </Ltr>
          <Button
            variant="ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {tCommon('next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PaymentsPageInner />
    </Suspense>
  );
}
