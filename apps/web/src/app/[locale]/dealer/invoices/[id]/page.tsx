'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { apiFetch } from '@/lib/api-client';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { Link, useRouter } from '@/i18n/navigation';
import { Board, BoardSkeleton, Button, DataBoard, DetailHero, ErrorBoard, Figure, Ledger, LedgerRow, Ltr, Meter, Stamp, Timeline, type BoardTone, type DataColumn, type TimelineItem } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type InvoiceLine = { id: string; description: string; quantity: string | number; unitPrice?: string | number; lineTotal?: string | number };
type InvoicePayment = { id: string; amount: string | number; method?: string | null; paidAt?: string | null; receivedAt?: string | null; reference?: string | null };
type InvoiceDetail = {
  id: string;
  number: string;
  status: string;
  total: string | number;
  subtotal?: string | number | null;
  taxTotal?: string | number | null;
  taxAmount?: string | number | null;
  paidAmount?: string | number | null;
  outstandingAmount?: string | number;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  salesOrder?: { id: string; number: string } | null;
  lines?: InvoiceLine[];
  payments?: InvoicePayment[];
};

function tone(status: string, overdue: boolean): BoardTone {
  const s = status.toUpperCase();
  if (s === 'PAID') return 'success';
  if (overdue || s === 'OVERDUE') return 'error';
  if (s === 'PARTIAL' || s === 'PARTIALLY_PAID') return 'warning';
  if (s === 'VOID' || s === 'CANCELLED' || s === 'DRAFT') return 'neutral';
  return 'brand';
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAcc = useTranslations('accounting');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const money = useDealerMoney();
  const router = useRouter();
  const { openPdf, pdfDialog } = usePdfDownload();
  const query = useQuery({ queryKey: ['customer-invoice', params.id], queryFn: () => apiFetch<InvoiceDetail>(`/api/v1/invoices/${params.id}`) });

  if (query.isLoading && !query.data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorBoard title={t('invoices')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }
  const inv = query.data;
  const total = Number(inv.total) || 0;
  const outstanding = Number(inv.outstandingAmount ?? 0) || 0;
  const paid = inv.paidAmount != null ? Number(inv.paidAmount) : Math.max(0, total - outstanding);
  const overdue = outstanding > 0 && Boolean(inv.dueDate) && new Date(inv.dueDate!).getTime() < Date.now();
  const heroTone = tone(inv.status, overdue);
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const label = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const columns: DataColumn<InvoiceLine>[] = [
    { key: 'description', header: tCommon('details'), cell: (l) => <span className="font-medium text-[var(--maher-text-primary)]">{l.description}</span> },
    { key: 'qty', header: tCommon('total'), numeric: true, width: '72px', cell: (l) => <Ltr>× {String(l.quantity)}</Ltr> },
    { key: 'unit', header: tCommon('total'), numeric: true, hideBelow: 'md', cell: (l) => <Ltr>{l.unitPrice != null ? money(Number(l.unitPrice)) : '—'}</Ltr> },
    { key: 'total', header: tCommon('total'), numeric: true, cell: (l) => <Ltr className="font-semibold">{money(l.lineTotal != null ? Number(l.lineTotal) : l.unitPrice != null ? Number(l.unitPrice) * Number(l.quantity) : 0)}</Ltr> },
  ];
  const timeline: TimelineItem[] = [
    inv.issueDate ? { id: 'issued', time: fmt.format(new Date(inv.issueDate)), title: label('ISSUED'), tone: 'info' as const } : null,
    ...(inv.payments ?? []).map((p) => ({ id: p.id, time: p.paidAt || p.receivedAt ? fmt.format(new Date((p.paidAt ?? p.receivedAt)!)) : undefined, title: money(Number(p.amount)), description: [p.method, p.reference].filter(Boolean).join(' · ') || undefined, tone: 'success' as const })),
    inv.dueDate && outstanding > 0 ? { id: 'due', time: fmt.format(new Date(inv.dueDate)), title: tAcc('dueDate'), tone: overdue ? ('error' as const) : ('warning' as const) } : null,
    inv.status.toUpperCase() === 'PAID' ? { id: 'paid', title: tAcc('paid'), tone: 'success' as const } : null,
  ].filter(Boolean) as TimelineItem[];

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        tone={heroTone}
        back={{ label: t('invoices'), onClick: () => router.push('/dealer/invoices') }}
        code={inv.number}
        title={outstanding > 0 ? tAcc('amountDue') : tAcc('paid')}
        subtitle={inv.salesOrder ? <Link href={`/dealer/orders/${inv.salesOrder.id}`} className="font-medium text-[var(--maher-brand)] hover:underline"><Ltr>{inv.salesOrder.number}</Ltr></Link> : undefined}
        status={{ label: overdue ? tAcc('overdueInvoices') : label(inv.status), tone: heroTone }}
        facts={[
          { label: tCommon('total'), value: money(total), ltr: true },
          { label: tAcc('paid'), value: money(paid), ltr: true, tone: 'success' },
          { label: tAcc('outstanding'), value: money(outstanding), ltr: true, tone: outstanding > 0 ? heroTone : 'success' },
          ...(inv.dueDate ? [{ label: tAcc('dueDate'), value: fmt.format(new Date(inv.dueDate)), ltr: true, tone: overdue ? ('error' as const) : undefined }] : []),
        ]}
        primary={
          <Button leadingIcon={<FileText className="h-4 w-4" />} onClick={() => openPdf({ path: `/api/v1/invoices/${inv.id}/pdf`, documentName: inv.number, filename: `${inv.number}.pdf` })}>
            {tAcc('downloadPdf')}
          </Button>
        }
        actions={<Button variant="secondary" onClick={() => router.push('/dealer/payments')}>{t('payments')}</Button>}
      >
        {total > 0 ? <Meter value={paid} max={total} tone={outstanding > 0 ? heroTone : 'success'} label={tAcc('paid')} valueLabel={`${Math.round((paid / total) * 100)}%`} /> : null}
      </DetailHero>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DataBoard<InvoiceLine> aria-label={tCommon('details')} title={tCommon('details')} meta={<Stamp tone="neutral" size="sm">{inv.lines?.length ?? 0}</Stamp>} columns={columns} rows={inv.lines ?? []} rowKey={(l) => l.id} mobileRow={(l) => ({ title: l.description, meta: `× ${String(l.quantity)}`, trailing: <Ltr className="font-semibold">{money(l.lineTotal != null ? Number(l.lineTotal) : 0)}</Ltr> })} empty={<Board.Empty title={tCommon('none')} />} />
          {inv.notes ? (
            <Board tone="neutral">
              <Board.Header title={tCommon('notes')} />
              <Board.Body>
                <p className="whitespace-pre-wrap text-[14px] leading-6 text-[var(--maher-text-secondary)]">{inv.notes}</p>
              </Board.Body>
            </Board>
          ) : null}
        </div>
        <div className="space-y-5 xl:col-span-4">
          <Board tone={heroTone} wash="top">
            <Board.Header title={tAcc('balance')} />
            <Board.Body className="space-y-4">
              <Figure size="lg" value={money(outstanding)} label={tAcc('amountDue')} tone={outstanding > 0 ? heroTone : 'success'} locale={locale} />
              <Ledger>
                {inv.subtotal != null ? <LedgerRow label={tCommon('total')} value={<Ltr>{money(Number(inv.subtotal))}</Ltr>} /> : null}
                {inv.taxAmount ?? inv.taxTotal ? <LedgerRow label="VAT" value={<Ltr>{money(Number(inv.taxAmount ?? inv.taxTotal))}</Ltr>} /> : null}
                <LedgerRow label={tCommon('total')} value={<Ltr className="font-semibold">{money(total)}</Ltr>} />
                <LedgerRow label={tAcc('paid')} value={<Ltr>{money(paid)}</Ltr>} tone="success" stamp />
                <LedgerRow label={tAcc('outstanding')} value={<Ltr className="font-semibold">{money(outstanding)}</Ltr>} tone={outstanding > 0 ? heroTone : 'success'} stamp />
              </Ledger>
            </Board.Body>
          </Board>
          <Board tone="neutral">
            <Board.Header title={tCommon('history')} />
            <Board.Body>{timeline.length ? <Timeline items={timeline} dense /> : <p className="text-[13px] text-[var(--maher-text-tertiary)]">—</p>}</Board.Body>
          </Board>
        </div>
      </div>
      {pdfDialog}
    </div>
  );
}
