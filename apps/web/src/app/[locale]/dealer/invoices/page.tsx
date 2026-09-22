'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { DealerListDesk } from '@/components/dealer/dealer-list-desk';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { Button, Ltr, Meter, Stamp, type BoardTone } from '@maher/ui';
import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface Invoice {
  id: string;
  number: string;
  total: string | number;
  paidAmount?: string | number | null;
  outstandingAmount?: string | number;
  status: string;
  issueDate?: string | null;
  dueDate?: string | null;
}

const OPEN = new Set(['ISSUED', 'PARTIAL', 'PARTIALLY_PAID', 'SENT', 'OVERDUE']);

function tone(status: string): BoardTone {
  const s = status.toUpperCase();
  if (s === 'PAID') return 'success';
  if (s === 'OVERDUE') return 'error';
  if (s === 'PARTIAL' || s === 'PARTIALLY_PAID') return 'warning';
  if (s === 'VOID' || s === 'CANCELLED') return 'neutral';
  if (s === 'DRAFT') return 'neutral';
  return 'brand';
}

export default function InvoicesPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAcc = useTranslations('accounting');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const money = useDealerMoney();
  const { openPdf, pdfDialog } = usePdfDownload();
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const label = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const isOverdue = (r: Invoice) => r.status.toUpperCase() === 'OVERDUE' || (OPEN.has(r.status.toUpperCase()) && Boolean(r.dueDate) && new Date(r.dueDate!).getTime() < Date.now() && Number(r.outstandingAmount ?? 0) > 0);
  const outstanding = (rows: Invoice[]) => rows.reduce((acc, r) => acc + (Number(r.outstandingAmount) || 0), 0);

  return (
    <>
      <DealerListDesk<Invoice>
        title={t('invoices')}
        description={tAcc('invoicesHint')}
        tone="brand"
        queryKey={['customer-invoices']}
        fetchPath="/api/v1/invoices?pageSize=50"
        emptyTitle={tCommon('emptyList')}
        emptyDescription={tCommon('invoicesSubtitle')}
        rowHref={(row) => `/dealer/invoices/${row.id}`}
        chips={[
          { id: 'all', label: tCommon('all'), match: () => true },
          { id: 'open', label: tAcc('openInvoices'), tone: 'brand', match: (r) => OPEN.has(r.status.toUpperCase()) && !isOverdue(r) },
          { id: 'overdue', label: tAcc('overdueInvoices'), tone: 'error', match: isOverdue },
          { id: 'paid', label: tAcc('paidInvoices'), tone: 'success', match: (r) => r.status.toUpperCase() === 'PAID' },
        ]}
        figures={(rows) => [
          { label: tAcc('outstanding'), value: money(outstanding(rows)), tone: outstanding(rows) > 0 ? 'warning' : 'success' },
          { label: tAcc('overdueInvoices'), value: rows.filter(isOverdue).length, tone: rows.filter(isOverdue).length ? 'error' : 'neutral' },
          { label: tAcc('paidInvoices'), value: rows.filter((r) => r.status.toUpperCase() === 'PAID').length, tone: 'success' },
        ]}
        search={{ placeholder: tCommon('number'), match: (r, q) => r.number.toLowerCase().includes(q) }}
        columns={[
          {
            key: 'number',
            header: tCommon('number'),
            cell: (row) => (
              <span className="min-w-0">
                <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{row.number}</Ltr>
                {row.issueDate ? <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{tAcc('issuedOn', { date: dateFmt.format(new Date(row.issueDate)) })}</Ltr> : null}
              </span>
            ),
          },
          { key: 'due', header: tAcc('dueDate'), hideBelow: 'md', cell: (row) => (row.dueDate ? <Ltr className={isOverdue(row) ? 'font-medium text-[var(--maher-error)]' : 'text-[var(--maher-text-secondary)]'}>{dateFmt.format(new Date(row.dueDate))}</Ltr> : '—') },
          {
            key: 'paid',
            header: tAcc('paid'),
            hideBelow: 'lg',
            width: '160px',
            cell: (row) => {
              const total = Number(row.total) || 0;
              const out = Number(row.outstandingAmount ?? 0) || 0;
              return total > 0 ? <Meter value={Math.max(0, total - out)} max={total} tone={out > 0 ? 'warning' : 'success'} valueLabel={`${Math.round(((total - out) / total) * 100)}%`} /> : '—';
            },
          },
          { key: 'total', header: tCommon('total'), numeric: true, cell: (row) => <Ltr className="font-semibold">{money(Number(row.total))}</Ltr> },
          { key: 'outstanding', header: tAcc('outstanding'), numeric: true, hideBelow: 'md', cell: (row) => <Ltr className={Number(row.outstandingAmount ?? 0) > 0 ? 'font-medium text-[var(--maher-warning)]' : 'text-[var(--maher-text-tertiary)]'}>{money(Number(row.outstandingAmount ?? 0))}</Ltr> },
          { key: 'status', header: tCommon('status'), cell: (row) => <Stamp tone={isOverdue(row) ? 'error' : tone(row.status)} size="sm">{isOverdue(row) ? tAcc('overdueInvoices') : label(row.status)}</Stamp> },
          {
            key: 'pdf',
            header: '',
            numeric: true,
            width: '56px',
            cell: (row) => (
              <Button
                size="sm"
                variant="ghost"
                aria-label={tAcc('downloadPdf')}
                onClick={(e) => {
                  e.stopPropagation();
                  openPdf({ path: `/api/v1/invoices/${row.id}/pdf`, documentName: row.number, filename: `${row.number}.pdf` });
                }}
              >
                <FileText className="h-4 w-4" />
              </Button>
            ),
          },
        ]}
        mobileRow={(row) => ({ title: row.number, meta: `${money(Number(row.total))} · ${tAcc('outstanding')} ${money(Number(row.outstandingAmount ?? 0))}`, trailing: <Stamp tone={isOverdue(row) ? 'error' : tone(row.status)} size="sm">{label(row.status)}</Stamp> })}
      />
      {pdfDialog}
    </>
  );
}
