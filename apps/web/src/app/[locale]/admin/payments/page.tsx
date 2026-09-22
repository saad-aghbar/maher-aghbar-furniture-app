'use client';

import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName } from '@maher/i18n';
import { Board, Button, ConfirmDialog, DataBoard, DateRangeField, ErrorBoard, Figure, ListToolbar, Ltr, Menu, Pagination, Ribbon, Sparkline, Stamp, useToast, type BoardTone, type DataColumn } from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

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
  allocations?: Array<{ id: string; amount: string | number; invoice?: { id: string; number: string } | null }>;
}

const METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;
const methodTone = (m: string): BoardTone => (m === 'CASH' ? 'success' : m === 'BANK_TRANSFER' ? 'info' : m === 'CHEQUE' ? 'warning' : 'neutral');

const DEFAULTS = { q: '', customerId: '', method: '', dateFrom: '', dateTo: '', page: 1, pageSize: 25 };

function PaymentsPageInner() {
  const locale = useLocale();
  const ta = useTranslations('accounting');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { openPdf, pdfDialog } = usePdfDownload();
  const { params, set, reset, activeCount } = useListParams({ defaults: DEFAULTS });
  const [deleting, setDeleting] = useState<PaymentRow | null>(null);
  const currency = tCommon('currency');
  const money = (v: unknown) => {
    const n = Number(v ?? 0);
    try {
      return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : locale === 'he' ? 'he-IL' : 'en-JO', { style: 'currency', currency: currency === 'JOD' || currency === 'ILS' ? currency : 'ILS', maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  };

  const apiQuery = useMemo(() => toApiQuery({ page: params.page, pageSize: params.pageSize, q: params.q.trim() || undefined, customerId: params.customerId || undefined, method: params.method || undefined, dateFrom: params.dateFrom || undefined, dateTo: params.dateTo || undefined }), [params]);
  const list = useQuery({ queryKey: ['payments', apiQuery], queryFn: () => apiFetch<Paginated<PaymentRow>>(`/api/v1/payments${apiQuery}`), placeholderData: keepPreviousData });
  const pulse = useQuery({
    queryKey: ['payments-pulse'],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 29);
      const res = await apiFetch<Paginated<PaymentRow>>(`/api/v1/payments${toApiQuery({ pageSize: 100, dateFrom: from.toISOString().slice(0, 10) })}`);
      const days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
      const buckets = days.map((d) => res.data.filter((p) => p.paymentDate?.slice(0, 10) === d).reduce((s, p) => s + Number(p.amount), 0));
      const byMethod = new Map<string, number>();
      for (const p of res.data) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
      return { total30: buckets.reduce((s, v) => s + v, 0), count30: res.data.length, buckets, byMethod, unallocated: res.data.reduce((s, p) => s + Number(p.unallocatedAmount ?? 0), 0) };
    },
    staleTime: 60_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/payments/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleting(null);
      toast.success(ta('paymentDeleted'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['payments'] }), qc.invalidateQueries({ queryKey: ['payments-pulse'] }), qc.invalidateQueries({ queryKey: ['invoices'] })]);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const p = pulse.data;
  const dealerName = (c?: PaymentCustomer | null) => (c ? (c.nameAr || c.nameEn || c.nameHe ? localizedName(locale, c, c.name ?? '') : c.name ?? '—') : '—');
  const methodLabel = (m: string) => ta(`method${m}` as 'methodCASH');
  const date = (v?: string) => (v ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v)) : '—');

  const columns: DataColumn<PaymentRow>[] = [
    {
      key: 'number',
      header: ta('paymentNumber'),
      cell: (r) => (
        <span className="min-w-0">
          <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{r.number}</Ltr>
          <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{r.referenceNumber ?? ''}</span>
        </span>
      ),
    },
    { key: 'customer', header: ta('customer'), cell: (r) => (r.customer ? <Link href={`/admin/customers/${r.customer.id}`} className="hover:text-[var(--maher-brand)]">{dealerName(r.customer)}</Link> : '—') },
    { key: 'date', header: ta('paymentDate'), hideBelow: 'md', cell: (r) => date(r.paymentDate) },
    { key: 'method', header: ta('paymentMethod'), hideBelow: 'md', cell: (r) => <Stamp tone={methodTone(r.method)} size="sm">{methodLabel(r.method)}</Stamp> },
    { key: 'invoices', header: tNav('invoices'), hideBelow: 'lg', cell: (r) => (r.allocations?.length ? r.allocations.map((a) => a.invoice?.number).filter(Boolean).join(', ') : r.invoice?.number ?? '—') },
    { key: 'amount', header: ta('amount'), numeric: true, cell: (r) => <span className="font-semibold text-[var(--maher-success)]">{money(r.amount)}</span> },
    { key: 'unallocated', header: ta('addedToAccountCredit'), numeric: true, hideBelow: 'xl', cell: (r) => (Number(r.unallocatedAmount ?? 0) > 0 ? <Stamp tone="info" size="sm">{money(r.unallocatedAmount)}</Stamp> : '—') },
    {
      key: 'actions',
      header: '',
      numeric: true,
      width: '56px',
      cell: (r) => (
        <Menu
          aria-label={tCommon('actions')}
          trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
          items={[
            { id: 'pdf', label: ta('downloadPdf'), icon: <FileText className="h-4 w-4" />, onSelect: () => openPdf({ path: `/api/v1/payments/${r.id}/pdf`, documentName: r.number, filename: `${r.number}.pdf` }) },
            ...(r.invoice ? [{ id: 'inv', label: r.invoice.number, href: `/admin/invoices/${r.invoice.id}` }] : []),
            { id: 'del', label: ta('deletePayment'), icon: <Trash2 className="h-4 w-4" />, tone: 'error' as const, separator: true, onSelect: () => setDeleting(r) },
          ]}
          LinkComponent={Link}
        />
      ),
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="success" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] xl:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tNav('payments')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{ta('paymentsHint')}</p>
            {p ? (
              <div className="mt-4 rounded-[12px] border border-[var(--maher-border)] px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-[var(--maher-text-tertiary)]">{tSales('desk.paymentsLast30')}</span>
                  <Ltr className="text-[14px] font-semibold text-[var(--maher-text-primary)]">{money(p.total30)}</Ltr>
                </div>
                <Sparkline points={p.buckets} tone="success" height={40} area endDot className="mt-2 w-full" />
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            {p ? <Ribbon size="sm" segments={METHODS.filter((m) => p.byMethod.get(m)).map((m) => ({ key: m, label: methodLabel(m), value: p.byMethod.get(m) ?? 0, tone: methodTone(m) }))} /> : null}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={money(p?.total30 ?? 0)} label={tSales('desk.paymentsLast30')} tone="success" locale={locale} />
              <Figure size="sm" value={p?.count30 ?? 0} label={tNav('payments')} />
              <Figure size="sm" value={money(p?.unallocated ?? 0)} label={ta('accountCredit')} tone={p && p.unallocated > 0 ? 'info' : 'neutral'} locale={locale} />
              <Figure size="sm" value={meta?.totalItems ?? rows.length} label={tCommon('all')} tone="neutral" />
            </div>
          </div>
        </div>
      </Board>

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q, page: 1 }, { replace: true }), placeholder: tCommon('search') }}
        actions={
          <>
            <DealerCombobox value={params.customerId || null} onChange={(id) => set({ customerId: id ?? '', page: 1 })} placeholder={ta('allCustomers')} />
            <DateRangeField from={params.dateFrom} to={params.dateTo} onChange={(range) => set({ dateFrom: range.from, dateTo: range.to, page: 1 })} />
          </>
        }
      />

      {list.isError && !list.data ? (
        <ErrorBoard title={tNav('payments')} description={mutationErrorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<PaymentRow>
          aria-label={tNav('payments')}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={list.isLoading && !list.data}
          mobileRow={(r) => ({ title: `${r.number} · ${dealerName(r.customer)}`, meta: `${date(r.paymentDate)} · ${methodLabel(r.method)}`, trailing: <span className="font-semibold text-[var(--maher-success)]">{money(r.amount)}</span> })}
          empty={<Board.Empty title={ta('noPayments')} action={params.q || activeCount ? <Button size="sm" variant="secondary" onClick={reset}>{tCommon('clearFilters')}</Button> : undefined} />}
          footer={meta && meta.totalPages > 1 ? <Pagination className="w-full" page={params.page} pageSize={params.pageSize} total={meta.totalItems} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
        />
      )}

      <ConfirmDialog open={Boolean(deleting)} title={ta('deletePayment')} description={deleting ? `${deleting.number} · ${money(deleting.amount)} · ${ta('deletePaymentHint')}` : ''} danger confirmLabel={tCommon('delete')} cancelLabel={tCommon('cancel')} loading={remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)} />
      {pdfDialog}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <PaymentsPageInner />
    </Suspense>
  );
}
