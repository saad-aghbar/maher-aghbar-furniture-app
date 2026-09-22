'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { Board, BoardSkeleton, Button, DataBoard, DateRangeField, ErrorBoard, Figure, Ledger, LedgerRow, ListToolbar, Ltr, Ribbon, Stamp, StatusChips, type DataColumn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface StatementEntry {
  date: string;
  reference: string;
  description: string;
  type?: string;
  debit: string | number;
  credit: string | number;
  balance: string | number;
}

interface Statement {
  openingBalance: string | number;
  closingBalance: string | number;
  amountDue?: number;
  availableCredit?: number;
  openInvoiceCount?: number;
  overdueAmount?: number;
  totalInvoiced?: string | number;
  totalPaid?: string | number;
  currency: string;
  asOf: string;
  from?: string | null;
  to?: string | null;
  entries: StatementEntry[];
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StatementPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAcc = useTranslations('accounting');
  const locale = useLocale();
  const kit = useKitCopy();
  const money = useDealerMoney();
  const { openPdf, pdfDialog } = usePdfDownload();
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return { from: ymd(from), to: ymd(to) };
  });
  const [type, setType] = useState<'all' | 'debit' | 'credit'>('all');
  const [q, setQ] = useState('');

  const me = useQuery({ queryKey: ['auth-me'], queryFn: () => apiFetch<{ customerId?: string }>('/api/v1/auth/me') });
  const customerId = me.data?.customerId;
  const qs = new URLSearchParams();
  if (range.from) qs.set('from', range.from);
  if (range.to) qs.set('to', range.to);
  const query = useQuery({
    queryKey: ['statement', customerId, range.from, range.to],
    enabled: Boolean(customerId),
    queryFn: () => apiFetch<Statement>(`/api/v1/statements/${customerId}${qs.toString() ? `?${qs}` : ''}`),
  });

  const entries = useMemo(() => {
    const all = (query.data?.entries ?? []).map((e, i) => ({ ...e, id: `${e.reference}-${e.date}-${i}` }));
    const needle = q.trim().toLowerCase();
    return all.filter((e) => {
      if (type === 'debit' && !(Number(e.debit) > 0)) return false;
      if (type === 'credit' && !(Number(e.credit) > 0)) return false;
      if (needle && !`${e.reference} ${e.description}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [query.data?.entries, type, q]);

  if ((me.isLoading || query.isLoading) && !query.data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }
  if (me.isError || query.isError || !query.data) {
    return <ErrorBoard title={t('statement')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }
  const data = query.data;
  const closing = Number(data.closingBalance) || 0;
  const invoiced = Number(data.totalInvoiced ?? data.entries.reduce((a, e) => a + Number(e.debit || 0), 0));
  const paid = Number(data.totalPaid ?? data.entries.reduce((a, e) => a + Number(e.credit || 0), 0));
  const heroTone = (data.overdueAmount ?? 0) > 0 ? 'error' : closing > 0 ? 'warning' : 'success';
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const debits = data.entries.filter((e) => Number(e.debit) > 0).length;
  const credits = data.entries.filter((e) => Number(e.credit) > 0).length;

  const columns: DataColumn<StatementEntry & { id: string }>[] = [
    { key: 'date', header: tCommon('date'), width: '140px', cell: (e) => <Ltr className="text-[var(--maher-text-secondary)]">{dateFmt.format(new Date(e.date))}</Ltr> },
    {
      key: 'description',
      header: tCommon('details'),
      cell: (e) => (
        <span className="flex items-center gap-2">
          <Stamp tone={Number(e.credit) > 0 ? 'success' : 'brand'} size="sm">{Number(e.credit) > 0 ? tAcc('credits') : tAcc('debits')}</Stamp>
          <span className="font-medium text-[var(--maher-text-primary)]">{e.description}</span>
        </span>
      ),
    },
    { key: 'debit', header: tAcc('debits'), numeric: true, hideBelow: 'md', cell: (e) => (Number(e.debit) > 0 ? <Ltr>{money(Number(e.debit))}</Ltr> : <span className="text-[var(--maher-text-tertiary)]">—</span>) },
    { key: 'credit', header: tAcc('credits'), numeric: true, hideBelow: 'md', cell: (e) => (Number(e.credit) > 0 ? <Ltr className="text-[var(--maher-success)]">{money(Number(e.credit))}</Ltr> : <span className="text-[var(--maher-text-tertiary)]">—</span>) },
    { key: 'balance', header: tAcc('balance'), numeric: true, cell: (e) => <Ltr className="font-semibold">{money(Number(e.balance))}</Ltr> },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={heroTone} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('statement')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tAcc('statementHint')}</p>
            </div>
            <Button
              leadingIcon={<FileText className="h-4 w-4" />}
              onClick={() => customerId && openPdf({ path: `/api/v1/statements/${customerId}/pdf`, documentName: t('statement'), filename: `statement-${range.from}-${range.to}.pdf`, withRange: true, defaultRange: range })}
            >
              {tAcc('downloadPdf')}
            </Button>
          </div>
          <div className="min-w-0">
            <Ribbon size="sm" segments={[{ key: 'debits', label: tAcc('debits'), value: debits, tone: 'brand' }, { key: 'credits', label: tAcc('credits'), value: credits, tone: 'success' }]} />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={money(closing)} label={tAcc('closingBalance')} tone={heroTone} locale={locale} />
              <Figure size="sm" value={money(invoiced)} label={tAcc('totalInvoiced')} locale={locale} />
              <Figure size="sm" value={money(paid)} label={tAcc('totalPaid')} tone="success" locale={locale} />
            </div>
          </div>
        </div>
      </Board>

      <ListToolbar copy={kit.toolbar} search={{ value: q, onChange: setQ, placeholder: tCommon('search') }} actions={<DateRangeField size="sm" from={range.from} to={range.to} onChange={setRange} copy={kit.range} locale={locale} />} />

      <StatusChips
        aria-label={tAcc('entries')}
        value={type}
        onChange={(id) => setType(id as 'all' | 'debit' | 'credit')}
        items={[
          { id: 'all', label: tCommon('all'), count: data.entries.length },
          { id: 'debit', label: tAcc('debits'), count: debits, tone: 'brand' },
          { id: 'credit', label: tAcc('credits'), count: credits, tone: 'success' },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DataBoard<StatementEntry & { id: string }>
            aria-label={tAcc('entries')}
            columns={columns}
            rows={entries}
            rowKey={(e) => e.id}
            mobileRow={(e) => ({ title: e.description, meta: dateFmt.format(new Date(e.date)), trailing: <Ltr className="font-semibold">{money(Number(e.balance))}</Ltr> })}
            empty={<Board.Empty title={tCommon('emptyList')} />}
          />
        </div>
        <div className="xl:col-span-4">
          <Board tone={heroTone} className="xl:sticky xl:top-28">
            <Board.Header title={tAcc('balance')} description={<Ltr>{`${range.from} → ${range.to}`}</Ltr>} />
            <Board.Body className="space-y-4">
              <Figure size="lg" value={money(closing)} label={tAcc('closingBalance')} tone={heroTone} locale={locale} />
              <Ledger>
                <LedgerRow label={tAcc('openingBalance')} value={<Ltr>{money(Number(data.openingBalance))}</Ltr>} />
                <LedgerRow label={tAcc('totalInvoiced')} value={<Ltr>+{money(invoiced)}</Ltr>} tone="brand" stamp />
                <LedgerRow label={tAcc('totalPaid')} value={<Ltr>−{money(paid)}</Ltr>} tone="success" stamp />
                <LedgerRow label={tAcc('closingBalance')} value={<Ltr className="font-semibold">{money(closing)}</Ltr>} tone={heroTone} stamp />
                {data.amountDue != null ? <LedgerRow label={tAcc('amountDue')} value={<Ltr>{money(data.amountDue)}</Ltr>} tone={data.amountDue > 0 ? 'warning' : 'success'} /> : null}
                {(data.overdueAmount ?? 0) > 0 ? <LedgerRow label={tAcc('overdueAmount')} value={<Ltr>{money(data.overdueAmount ?? 0)}</Ltr>} tone="error" stamp /> : null}
                {data.availableCredit != null ? <LedgerRow label={tAcc('availableCredit')} value={<Ltr>{money(data.availableCredit)}</Ltr>} tone="info" /> : null}
              </Ledger>
            </Board.Body>
          </Board>
        </div>
      </div>
      {pdfDialog}
    </div>
  );
}
