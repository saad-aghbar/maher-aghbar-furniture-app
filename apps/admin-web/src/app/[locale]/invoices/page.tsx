'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError, API_URL } from '@/lib/api-client';
import { INVOICE_STATUSES, statusOptions } from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Ltr,
  Modal,
  MotionSection,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
  cn,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface InvoiceCustomer {
  id: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  outstandingAmount?: string | number;
  dueDate?: string | null;
  customerId?: string;
  customer?: InvoiceCustomer | null;
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
}

interface CustomerOption {
  id: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

interface SalesOrderOption {
  id: string;
  number: string;
  status: string;
  title?: string | null;
  imageUrl?: string | null;
  total?: string | number | null;
  sellerPrice?: string | number | null;
  externalOrderNumber?: string | null;
  customer?: {
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  quotation?: {
    request?: {
      endCustomerName?: string | null;
      externalOrderNumber?: string | null;
    } | null;
  } | null;
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function dealerOrderNumber(so: SalesOrderOption) {
  return (
    so.externalOrderNumber?.trim() ||
    so.quotation?.request?.externalOrderNumber?.trim() ||
    null
  );
}

function customerLabel(so: SalesOrderOption) {
  const c = so.customer;
  if (!c) return null;
  return c.nameEn || c.nameAr || c.name || c.nameHe || null;
}

function money(value: string | number | undefined, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

function isOverdue(row: InvoiceRow) {
  if (row.status === 'OVERDUE') return true;
  if (!row.dueDate) return false;
  if (!(Number(row.outstandingAmount) > 0)) return false;
  return new Date(row.dueDate).getTime() < Date.now();
}

function invoiceCustomerName(locale: string, customer?: InvoiceCustomer | null) {
  if (!customer) return '—';
  return customer.nameAr || customer.nameEn || customer.nameHe
    ? localizedName(locale, customer, customer.name)
    : customer.name;
}

function InvoicesPageInner() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const ta = useTranslations('accounting');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const currency = tCommon('currency');

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [customerId, setCustomerId] = useState('');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [soSearch, setSoSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const fromUrl = searchParams.get('status') ?? '';
    setStatus(fromUrl);
    setPage(1);
  }, [searchParams]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (debouncedQ) params.set('q', debouncedQ);
    if (status) params.set('status', status);
    if (customerId) params.set('customerId', customerId);
    return params.toString();
  }, [debouncedQ, status, customerId, page]);

  const listQuery = useQuery({
    queryKey: ['invoices', listParams],
    queryFn: () =>
      apiFetch<{ data: InvoiceRow[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/invoices?${listParams}`,
      ),
    placeholderData: keepPreviousData,
  });

  const customersQuery = useQuery({
    queryKey: ['customers-invoice-filter'],
    queryFn: () =>
      apiFetch<{ data: CustomerOption[] }>('/api/v1/customers?pageSize=100').then((r) => r.data),
  });

  const soQuery = useQuery({
    queryKey: ['sales-orders-for-invoice'],
    queryFn: () =>
      apiFetch<{ data: SalesOrderOption[] }>('/api/v1/sales-orders?pageSize=100').then(
        (r) => r.data,
      ),
    enabled: createOpen,
  });

  const filteredSalesOrders = useMemo(() => {
    const rows = soQuery.data ?? [];
    const needle = soSearch.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((so) => {
      const hay = [
        so.number,
        so.title,
        dealerOrderNumber(so),
        customerLabel(so),
        so.quotation?.request?.endCustomerName,
        so.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [soQuery.data, soSearch]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!salesOrderId) throw new ApiClientError(tc('selectSalesOrder'), 400);
      return apiFetch('/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({ salesOrderId }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCreateOpen(false);
      setBanner(ta('invoiceCreated'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const statusFilterOptions = statusOptions(tStatus, INVOICE_STATUSES, {
    label: tCommon('all'),
  });

  const customers = customersQuery.data ?? [];
  const rows = listQuery.data?.data ?? [];

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 maher-animate-fade" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl maher-animate-rise" />
          ))}
        </div>
      </div>
    );
  }
  if (listQuery.isError && !listQuery.data) {
    return (
      <ErrorState
        title={t('invoices')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const meta = listQuery.data?.meta;

  return (
    <div className="space-y-6">
      <MotionSection enter="rise">
        <PageHero
          title={t('invoices')}
          description={ta('emptyHint')}
          tone="soft"
          actions={
            <Button
              className="maher-lift"
              onClick={() => {
                setSalesOrderId('');
                setSoSearch('');
                setFormError(null);
                setCreateOpen(true);
              }}
            >
              {ta('createFromSalesOrder')}
            </Button>
          }
        />
      </MotionSection>

      {banner ? (
        <MotionSection enter="drop" className="maher-animate-bounce-in">
          <Alert variant="success">{banner}</Alert>
        </MotionSection>
      ) : null}

      <MotionSection enter="rise" delayMs={40} className="space-y-4">
        <div className="maher-invoices-filters maher-stagger flex flex-wrap items-end gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Input
              withSearchIcon
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder={ta('searchPlaceholder')}
            />
          </label>
          <Select
            label={tc('customer')}
            value={customerId}
            onChange={(e) => {
              setPage(1);
              setCustomerId(e.target.value);
            }}
            className="min-w-[180px] w-52"
          >
            <option value="">{ta('allCustomers')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr || c.nameEn || c.nameHe
                  ? localizedName(locale, c, c.name)
                  : c.name}
              </option>
            ))}
          </Select>
          <Select
            label={tCommon('status')}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            options={statusFilterOptions}
            className="w-48"
          />
        </div>

        {rows.length === 0 ? (
          <div className="maher-invoices-results">
            <EmptyState title={ta('empty')} description={ta('emptyHint')} />
          </div>
        ) : (
          <>
            <div
              className={`maher-invoices-results maher-stagger grid gap-3 md:grid-cols-2 ${
                listQuery.isFetching ? 'opacity-70 transition-opacity' : ''
              }`}
            >
              {rows.map((row) => {
                const overdue = isOverdue(row);
                const outstanding = Number(row.outstandingAmount ?? 0);
                const settled = Number.isFinite(outstanding) && outstanding <= 0;
                const factoryNo = row.salesOrder?.number ?? null;
                const dealerNo = row.salesOrder?.externalOrderNumber?.trim() || null;

                return (
                  <article
                    key={row.id}
                    className={cn(
                      'maher-invoices-card flex flex-col rounded-xl border bg-surface',
                      overdue
                        ? 'border-[color-mix(in_srgb,var(--maher-error)_40%,var(--maher-border))] border-s-[3px] border-s-[var(--maher-error)]'
                        : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 px-5 pt-5">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold tracking-tight text-text-primary">
                          <Ltr>{row.number}</Ltr>
                        </p>
                        <p className="mt-0.5 truncate text-sm text-text-secondary">
                          {invoiceCustomerName(locale, row.customer)}
                        </p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>

                    <div className="flex flex-1 flex-col justify-center px-5 py-5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                        {ta('outstanding')}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                        <p
                          className={cn(
                            'text-[1.75rem] font-semibold leading-none tracking-tight',
                            overdue
                              ? 'text-[var(--maher-error)]'
                              : settled
                                ? 'text-text-secondary'
                                : 'text-text-primary',
                          )}
                        >
                          <Ltr>{money(row.outstandingAmount, currency)}</Ltr>
                        </p>
                        <div className="text-start">
                          <p className="text-[11px] text-text-tertiary">{ta('dueDate')}</p>
                          <p
                            className={cn(
                              'mt-0.5 text-sm font-medium',
                              overdue ? 'text-[var(--maher-error)]' : 'text-text-primary',
                            )}
                          >
                            <Ltr>{row.dueDate ? row.dueDate.slice(0, 10) : '—'}</Ltr>
                          </p>
                          {overdue ? (
                            <p className="mt-0.5 text-[11px] font-semibold text-[var(--maher-error)]">
                              {ta('overdueHint')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-text-tertiary">
                        {ta('total')}{' '}
                        <Ltr className="font-medium text-text-secondary">
                          {money(row.total, currency)}
                        </Ltr>
                      </p>
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
                      <p className="min-w-0 truncate text-xs text-text-tertiary">
                        {[
                          factoryNo
                            ? `${ta('factoryOrderShort')} ${factoryNo}`
                            : null,
                          dealerNo ? `${ta('dealerOrderShort')} ${dealerNo}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link
                          href={`/invoices/${row.id}`}
                          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-brand transition hover:bg-[var(--maher-brand-soft)]"
                        >
                          {ta('viewDetails')}
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            window.open(`${API_URL}/api/v1/invoices/${row.id}/pdf`, '_blank');
                          }}
                        >
                          {tc('pdf')}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {meta && meta.totalPages > 1 ? (
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="maher-lift"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {tCommon('previous')}
                </Button>
                <span className="text-sm text-text-secondary" dir="ltr">
                  {page} / {meta.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="maher-lift"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {tCommon('next')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </MotionSection>

      <Modal
        open={createOpen}
        onClose={() => !createMutation.isPending && setCreateOpen(false)}
        title={ta('createInvoice')}
        description={ta('pickSalesOrderHint')}
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={createMutation.isPending}
              onClick={() => setCreateOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!salesOrderId}
              className="maher-lift"
              onClick={() => createMutation.mutate()}
            >
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}

          <Input
            withSearchIcon
            value={soSearch}
            onChange={(e) => setSoSearch(e.target.value)}
            placeholder={ta('searchSalesOrders')}
            disabled={soQuery.isLoading}
          />

          {soQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (soQuery.data ?? []).length === 0 ? (
            <EmptyState title={ta('noSalesOrdersAvailable')} />
          ) : filteredSalesOrders.length === 0 ? (
            <EmptyState title={ta('noSalesOrdersMatch')} />
          ) : (
            <div
              className="max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto pe-1"
              role="listbox"
              aria-label={tc('salesOrder')}
            >
              {filteredSalesOrders.map((so) => {
                const selected = salesOrderId === so.id;
                const img = mediaSrc(so.imageUrl);
                const dealerNo = dealerOrderNumber(so);
                const dealer = customerLabel(so);
                const endCustomer = so.quotation?.request?.endCustomerName?.trim() || null;
                const amount = Number(so.sellerPrice ?? so.total ?? NaN);
                return (
                  <button
                    key={so.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSalesOrderId(so.id)}
                    className={cn(
                      'maher-list-card flex w-full gap-3 rounded-xl border p-2.5 text-start transition',
                      selected
                        ? 'border-brand bg-[var(--maher-brand-soft)] shadow-sm'
                        : 'border-border bg-surface hover:border-brand/40 hover:bg-surface-muted',
                    )}
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                          <Armchair className="h-6 w-6 opacity-40" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-text-primary">
                          {so.title?.trim() || so.number}
                        </p>
                        <StatusBadge status={so.status} />
                      </div>
                      <p className="text-xs text-text-secondary" dir="ltr">
                        <span className="text-text-tertiary">{tSales('systemOrderNumber')}: </span>
                        <Ltr>{so.number}</Ltr>
                        {dealerNo ? (
                          <>
                            {' · '}
                            <span className="text-text-tertiary">
                              {tSales('dealerOrderNumber')}:{' '}
                            </span>
                            <Ltr>{dealerNo}</Ltr>
                          </>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {dealer ?? '—'}
                        {endCustomer ? (
                          <span className="text-text-tertiary">
                            {' · '}
                            {tSales('endCustomer')}: {endCustomer}
                          </span>
                        ) : null}
                      </p>
                      {Number.isFinite(amount) ? (
                        <p className="text-xs font-medium text-text-primary" dir="ltr">
                          {amount.toFixed(2)} {currency}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <InvoicesPageInner />
    </Suspense>
  );
}
