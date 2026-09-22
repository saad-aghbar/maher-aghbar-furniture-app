'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { Board, BoardSkeleton, Button, DataBoard, DateRangeField, ErrorBoard, Figure, ListToolbar, Ltr, Ribbon, Sparkline, Stamp, StatusChips, type BoardTone, type DataColumn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type Payment = {
  id: string;
  number: string;
  amount: string | number;
  method: string;
  paymentDate: string;
  referenceNumber?: string | null;
  invoice?: { id: string; number: string } | null;
};

type Summary = { amountDue?: number; availableCredit?: number; currency?: string; overdueAmount?: number; openInvoiceCount?: number };

const METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;
const METHOD_TONE: Record<string, BoardTone> = { CASH: 'success', BANK_TRANSFER: 'brand', CHEQUE: 'warning', CARD: 'info', OTHER: 'neutral' };

export default function PaymentsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAcc = useTranslations('accounting');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const kit = useKitCopy();
  const money = useDealerMoney();
  const { openPdf, pdfDialog } = usePdfDownload();
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('all');
  const [range, setRange] = useState({ from: '', to: '' });

  const me = useQuery({ queryKey: ['auth-me'], queryFn: () => apiFetch<{ customerId?: string }>('/api/v1/auth/me') });
  const customerId = me.data?.customerId;
  const summary = useQuery({ queryKey: ['dealer-finance-summary', customerId], enabled: Boolean(customerId), queryFn: () => apiFetch<Summary>(`/api/v1/payments/dealer/${customerId}/summary`), retry: false });
  const list = useQuery({
    queryKey: ['customer-payments', customerId],
    enabled: Boolean(customerId),
    queryFn: () => apiFetch<{ data: Payment[] } | Payment[]>(`/api/v1/payments?customerId=${customerId}&pageSize=200`).then((json) => (Array.isArray(json) ? json : json.data ?? [])),
  });

  const all = useMemo(() => list.data ?? [], [list.data]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((row) => {
      if (method !== 'all' && row.method !== method) return false;
      const day = row.paymentDate?.slice(0, 10) ?? '';
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      if (needle && !`${row.number} ${row.referenceNumber ?? ''} ${row.invoice?.number ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [all, method, range, q]);
  const methodCounts = useMemo(() => Object.fromEntries(METHODS.map((m) => [m, all.filter((r) => r.method === m).length])), [all]);
  const last30 = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });
    const byDay = new Map<string, number>();
    for (const row of all) {
      const key = row.paymentDate?.slice(0, 10);
      if (key) byDay.set(key, (byDay.get(key) ?? 0) + Number(row.amount || 0));
    }
    return days.map((d) => byDay.get(d) ?? 0);
  }, [all]);
  const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const methodLabel = (m: string) => {
    try {
      return tStatus(m as 'PENDING');
    } catch {
      return m.replaceAll('_', ' ').toLowerCase();
    }
  };
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  if ((me.isLoading || list.isLoading) && !list.data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }
  if (list.isError) return <ErrorBoard title={t('payments')} description={tCommon('loadFailed')} onRetry={() => list.refetch()} retryLabel={tCommon('retry')} />;

  const due = summary.data?.amountDue ?? 0;
  const columns: DataColumn<Payment>[] = [
    {
      key: 'number',
      header: tCommon('number'),
      cell: (row) => (
        <span className="min-w-0">
          <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{row.number}</Ltr>
          {row.referenceNumber ? <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{row.referenceNumber}</Ltr> : null}
        </span>
      ),
    },
    { key: 'date', header: tCommon('date'), hideBelow: 'md', cell: (row) => <Ltr className="text-[var(--maher-text-secondary)]">{row.paymentDate ? dateFmt.format(new Date(row.paymentDate)) : '—'}</Ltr> },
    { key: 'invoice', header: t('invoices'), hideBelow: 'lg', cell: (row) => (row.invoice ? <Ltr>{row.invoice.number}</Ltr> : '—') },
    { key: 'method', header: tCommon('paymentMethod'), cell: (row) => <Stamp tone={METHOD_TONE[row.method] ?? 'neutral'} size="sm">{methodLabel(row.method)}</Stamp> },
    { key: 'amount', header: tCommon('amount'), numeric: true, cell: (row) => <Ltr className="font-semibold text-[var(--maher-success)]">{money(Number(row.amount))}</Ltr> },
    {
      key: 'pdf',
      header: '',
      numeric: true,
      width: '56px',
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          aria-label={tAcc('receipt')}
          onClick={(e) => {
            e.stopPropagation();
            openPdf({ path: `/api/v1/payments/${row.id}/pdf`, documentName: row.number, filename: `${row.number}.pdf` });
          }}
        >
          <FileText className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={due > 0 ? 'warning' : 'success'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('payments')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tAcc('paymentsHint')}</p>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Figure size="sm" value={money(due)} label={tAcc('amountDue')} tone={due > 0 ? 'warning' : 'success'} locale={locale} />
              <Figure size="sm" value={money(summary.data?.availableCredit ?? 0)} label={tAcc('availableCredit')} tone="info" locale={locale} />
              <Figure size="sm" value={money(total)} label={tAcc('totalPaid')} tone="success" locale={locale} />
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <Sparkline points={last30} tone="success" area endDot baseline="zero" />
            <Ribbon size="sm" segments={METHODS.map((m) => ({ key: m, label: methodLabel(m), value: methodCounts[m] ?? 0, tone: METHOD_TONE[m] }))} />
          </div>
        </div>
      </Board>

      <ListToolbar copy={kit.toolbar} search={{ value: q, onChange: setQ, placeholder: tCommon('search') }} actions={<DateRangeField size="sm" from={range.from} to={range.to} onChange={setRange} copy={kit.range} locale={locale} />} />

      <StatusChips aria-label={tCommon('paymentMethod')} value={method} onChange={setMethod} items={[{ id: 'all', label: tCommon('all'), count: all.length }, ...METHODS.filter((m) => methodCounts[m]).map((m) => ({ id: m, label: methodLabel(m), count: methodCounts[m], tone: METHOD_TONE[m] }))]} />

      <DataBoard<Payment>
        aria-label={t('payments')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(row) => openPdf({ path: `/api/v1/payments/${row.id}/pdf`, documentName: row.number, filename: `${row.number}.pdf` })}
        mobileRow={(row) => ({ title: row.number, meta: `${row.paymentDate?.slice(0, 10) ?? ''} · ${methodLabel(row.method)}`, trailing: <Ltr className="font-semibold text-[var(--maher-success)]">{money(Number(row.amount))}</Ltr> })}
        empty={<Board.Empty title={tCommon('emptyList')} />}
        footer={rows.length ? <span className="text-[13px] text-[var(--maher-text-secondary)]">{rows.length} · <Ltr className="font-semibold text-[var(--maher-text-primary)]">{money(total)}</Ltr></span> : null}
      />
      {pdfDialog}
    </div>
  );
}
