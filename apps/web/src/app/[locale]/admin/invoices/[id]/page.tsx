'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { useKitCopy } from '@/lib/kit-copy';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ActionDock, Alert, Board, BoardSkeleton, Button, DateField, DetailHero, DocumentActions, ErrorBoard, Figure, Input, KeyFacts, Ledger, LedgerRow, Ltr, Meter, MoneyField, Sheet, Stamp, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableNumericCell, TableRow, Timeline, todayYmd, type BoardTone, SegmentedControl } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;

interface InvoiceDetail {
  id: string;
  number: string;
  status: string;
  invoiceDate?: string;
  dueDate?: string | null;
  currency?: string;
  subtotal?: string | number;
  taxTotal?: string | number;
  total?: string | number;
  paidAmount?: string | number;
  outstandingAmount?: string | number;
  customerId?: string;
  customer?: { id: string; name: string; code?: string };
  salesOrderId?: string | null;
  salesOrder?: {
    id: string;
    number: string;
    status: string;
    externalOrderNumber?: string | null;
  } | null;
  returnRequest?: {
    id: string;
    number: string;
    productDesc?: string | null;
  } | null;
  lines?: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    taxRate?: string | number;
    lineTotal: string | number;
  }>;
  payments?: Array<{
    id: string;
    number: string;
    paymentDate?: string;
    amount: string | number;
    method: string;
    referenceNumber?: string | null;
  }>;
  dealerFinance?: {
    amountDue: number;
    availableCredit: number;
    openInvoiceCount?: number;
    overdueAmount?: number;
  } | null;
}

type ApplyCreditPreview = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceOutstanding: number;
  availableCredit: number;
  applyAmount: number;
  invoiceRemainingAfter: number;
  creditRemainingAfter: number;
};

function money(value: string | number | undefined | null) {
  return Number(value ?? 0).toFixed(2);
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const ta = useTranslations('accounting');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const t = useTranslations('navigation');
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditPreview, setCreditPreview] = useState<ApplyCreditPreview | null>(null);
  const [creditBusy, setCreditBusy] = useState(false);
  const [paymentDate, setPaymentDate] = useState(todayYmd());
  const [payOpen, setPayOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const locale = useLocale();
  const kit = useKitCopy();
  const { openPdf, pdfDialog } = usePdfDownload();

  const detailQuery = useQuery({
    queryKey: ['invoice', params.id],
    queryFn: () => apiFetch<InvoiceDetail>(`/api/v1/invoices/${params.id}`),
  });

  const payN = Number(amount) || 0;

  const payMutation = useMutation({
    mutationFn: async () => {
      const invoice = detailQuery.data;
      if (!invoice) return;
      const customerId = invoice.customerId ?? invoice.customer?.id;
      const payAmount = Number(amount) || Number(invoice.outstandingAmount ?? 0);
      if (!customerId || !(payAmount > 0)) {
        throw new ApiClientError(tc('amountCustomerRequired'), 400);
      }
      const open = Math.max(0, Number(invoice.outstandingAmount ?? 0));
      const allocated = Math.min(payAmount, open);
      return apiFetch('/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          invoiceId: invoice.id,
          amount: payAmount,
          method,
          ...(reference.trim() ? { referenceNumber: reference.trim() } : {}),
          ...(paymentDate ? { paymentDate } : {}),
          idempotencyKey: `pay-${invoice.id}-${Date.now()}`,
          allocations: allocated > 0 ? [{ invoiceId: invoice.id, amount: allocated }] : [],
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      setBanner(ta('paymentRecorded'));
      setAmount('');
      setReference('');
      await queryClient.invalidateQueries({ queryKey: ['invoice', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const previewCredit = async () => {
    setFormError(null);
    setCreditBusy(true);
    try {
      const qs =
        creditAmount.trim() !== ''
          ? `?amount=${encodeURIComponent(creditAmount)}`
          : '';
      const preview = await apiFetch<ApplyCreditPreview>(
        `/api/v1/invoices/${params.id}/apply-credit/preview${qs}`,
      );
      setCreditPreview(preview);
    } catch (err) {
      setFormError(mutationErrorMessage(err));
      setCreditPreview(null);
    } finally {
      setCreditBusy(false);
    }
  };

  const confirmCredit = async () => {
    if (!creditPreview || !(creditPreview.applyAmount > 0)) return;
    setFormError(null);
    setCreditBusy(true);
    try {
      await apiFetch(`/api/v1/invoices/${params.id}/apply-credit`, {
        method: 'POST',
        body: JSON.stringify({
          amount: creditPreview.applyAmount,
          idempotencyKey: `credit-${params.id}-${Date.now()}`,
        }),
      });
      setBanner(ta('creditApplied'));
      setCreditPreview(null);
      setCreditAmount('');
      await queryClient.invalidateQueries({ queryKey: ['invoice', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
    } catch (err) {
      setFormError(mutationErrorMessage(err));
    } finally {
      setCreditBusy(false);
    }
  };

  if (detailQuery.isLoading) return <BoardSkeleton rows={6} />;
  if (detailQuery.isError || !detailQuery.data) return <ErrorBoard title={ta('detail')} description={mutationErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} />;

  const invoice = detailQuery.data;
  const lines = invoice.lines ?? [];
  const payments = invoice.payments ?? [];
  const outstanding = Number(invoice.outstandingAmount ?? 0);
  const availableCredit = Number(invoice.dealerFinance?.availableCredit ?? 0);
  const methodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: ta(`method${m}` as 'methodCASH'),
  }));
  const showApplyCredit = outstanding > 0 && availableCredit > 0;

  const total = Number(invoice.total ?? 0);
  const paid = Number(invoice.paidAmount ?? 0);
  const overdue = outstanding > 0 && Boolean(invoice.dueDate) && new Date(invoice.dueDate as string).getTime() < Date.now();
  const tone: BoardTone = outstanding <= 0 && invoice.status !== 'DRAFT' && invoice.status !== 'VOID' ? 'success' : overdue ? 'error' : paid > 0 ? 'warning' : invoice.status === 'DRAFT' ? 'neutral' : 'info';
  const date = (v?: string | null) => (v ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v)) : '—');
  const daysUntilDue = invoice.dueDate ? Math.round((new Date(invoice.dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null;
  const statusLabel = (s: string) => (tStatus.has(s as never) ? tStatus(s as never) : s.replace(/_/g, ' '));
  const openPay = () => (setAmount(String(outstanding)), setReference(''), setPaymentDate(todayYmd()), setFormError(null), setPayOpen(true));

  return (
    <div className="maher-stagger space-y-5 pb-28 md:pb-0">
      <DetailHero
        back={{ label: t('invoices'), href: '/admin/invoices' }}
        LinkComponent={Link}
        code={invoice.number}
        title={invoice.customer?.name ?? invoice.number}
        subtitle={[invoice.salesOrder?.number, invoice.salesOrder?.externalOrderNumber, invoice.returnRequest?.number].filter(Boolean).join(' · ') || undefined}
        status={{ label: statusLabel(invoice.status), tone }}
        tone={tone}
        media={
          <span className="flex h-20 w-20 flex-col items-center justify-center rounded-[14px] bg-[var(--maher-surface-muted)] text-center sm:h-24 sm:w-24">
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--maher-text-tertiary)] rtl:tracking-normal">{ta('balance')}</span>
            <Ltr className={`text-[15px] font-semibold ${outstanding > 0 ? (overdue ? 'text-[var(--maher-error)]' : 'text-[var(--maher-text-primary)]') : 'text-[var(--maher-success)]'}`}>{money(outstanding)}</Ltr>
          </span>
        }
        facts={[
          { label: ta('total'), value: money(total), ltr: true },
          { label: ta('paidAmount'), value: money(paid), ltr: true, tone: paid > 0 ? 'success' : undefined },
          { label: ta('balance'), value: money(outstanding), ltr: true, tone: outstanding > 0 ? tone : 'success' },
          { label: ta('invoiceDate'), value: date(invoice.invoiceDate), ltr: true },
          { label: ta('dueDate'), value: daysUntilDue == null ? date(invoice.dueDate) : `${date(invoice.dueDate)} · ${overdue ? tSales('desk.lateBy', { count: Math.abs(daysUntilDue) }) : tSales('desk.dueIn', { count: daysUntilDue })}`, ltr: true, tone: overdue ? 'error' : undefined },
        ]}
        primary={outstanding > 0 ? <Button onClick={openPay}>{ta('recordPayment')}</Button> : undefined}
        actions={
          <>
            {showApplyCredit ? (
              <Button variant="secondary" onClick={() => (setCreditAmount(String(Math.min(outstanding, availableCredit))), setCreditPreview(null), setCreditOpen(true))}>
                {ta('applyCredit')}
              </Button>
            ) : null}
            <DocumentActions size="sm" actions={[{ id: 'pdf', kind: 'pdf', label: ta('downloadPdf'), onClick: () => openPdf({ path: `/api/v1/invoices/${params.id}/pdf`, documentName: invoice.number, filename: `${invoice.number}.pdf` }) }]} />
          </>
        }
      >
        <Meter value={Math.min(paid, total)} max={Math.max(1, total)} label={ta('paidAmount')} valueLabel={`${money(paid)} / ${money(total)}`} tone={tone} />
      </DetailHero>

      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone={tone} wash="top" className="xl:col-span-4">
          <Board.Header title={ta('total')} />
          <Board.Body className="space-y-4">
            <Figure value={money(outstanding)} label={ta('balance')} tone={outstanding > 0 ? tone : 'success'} locale={locale} />
            <Ledger>
              <LedgerRow label={ta('subtotal')} value={money(invoice.subtotal)} />
              <LedgerRow label={ta('tax')} value={money(invoice.taxTotal)} />
              <LedgerRow label={ta('total')} value={<Ltr className="font-semibold">{money(total)}</Ltr>} />
              <LedgerRow label={ta('paidAmount')} value={money(paid)} tone="success" stamp={paid > 0} />
              {availableCredit > 0 ? <LedgerRow label={ta('accountCredit')} value={money(availableCredit)} tone="info" stamp /> : null}
            </Ledger>
          </Board.Body>
        </Board>

        <Board tone="neutral" className="xl:col-span-8">
          <Board.Header title={ta('detail')} />
          <Board.Body>
            <KeyFacts
              columns={3}
              facts={[
                { label: ta('customer'), value: invoice.customer ? <Link href={`/admin/customers/${invoice.customer.id}`} className="font-semibold text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)]">{invoice.customer.name}</Link> : '—' },
                { label: tSales('systemOrderNumber'), value: invoice.salesOrder ? <Link href={`/admin/sales-orders/${invoice.salesOrder.id}`} className="hover:text-[var(--maher-brand)]"><Ltr>{invoice.salesOrder.number}</Ltr></Link> : '—', ltr: true },
                { label: tSales('dealerOrderNumber'), value: invoice.salesOrder?.externalOrderNumber ?? '—', ltr: true },
                { label: ta('invoiceDate'), value: date(invoice.invoiceDate), ltr: true },
                { label: ta('dueDate'), value: date(invoice.dueDate), ltr: true },
                ...(invoice.returnRequest ? [{ label: ta('returnInvoice'), value: <Link href="/admin/returns" className="hover:text-[var(--maher-brand)]"><Ltr>{invoice.returnRequest.number}</Ltr></Link>, ltr: true }] : []),
              ]}
            />
          </Board.Body>
        </Board>
      </div>

      <Board tone="neutral">
        <Board.Header title={ta('lines')} meta={<Stamp tone="neutral" size="sm">{lines.length}</Stamp>} />
        {lines.length === 0 ? (
          <Board.Empty title={ta('noLines')} />
        ) : (
          <Table wrapperClassName="rounded-none border-0">
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta('description')}</TableHeaderCell>
                <TableHeaderCell data-numeric="true">{ta('qty')}</TableHeaderCell>
                <TableHeaderCell data-numeric="true">{ta('unitPrice')}</TableHeaderCell>
                <TableHeaderCell data-numeric="true">{ta('lineTotal')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableNumericCell data-numeric="true">{Number(line.quantity)}</TableNumericCell>
                  <TableNumericCell data-numeric="true">{money(line.unitPrice)}</TableNumericCell>
                  <TableNumericCell data-numeric="true">{money(line.lineTotal)}</TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Board>

      <Board tone={payments.length ? 'success' : 'neutral'}>
        <Board.Header title={ta('paymentHistory')} meta={payments.length ? <Stamp tone="success" size="sm">{payments.length}</Stamp> : null} actions={outstanding > 0 ? <Button size="sm" onClick={openPay}>{ta('recordPayment')}</Button> : null} />
        {payments.length === 0 ? (
          <Board.Empty title={ta('noPayments')} />
        ) : (
          <Timeline
            dense
            className="px-5 py-4"
            items={payments.map((p) => ({
              id: p.id,
              time: date(p.paymentDate),
              title: (
                <span className="flex flex-wrap items-center gap-2">
                  <Ltr className="font-semibold">{money(p.amount)}</Ltr>
                  <Stamp tone="success" size="sm">
                    {ta(`method${p.method}` as 'methodCASH')}
                  </Stamp>
                  <Ltr className="text-[12px] text-[var(--maher-text-tertiary)]">{p.number}</Ltr>
                </span>
              ),
              description: p.referenceNumber ? `${ta('reference')}: ${p.referenceNumber}` : undefined,
              tone: 'success' as BoardTone,
              children: (
                <Button size="sm" variant="ghost" onClick={() => openPdf({ path: `/api/v1/payments/${p.id}/pdf`, documentName: p.number, filename: `${p.number}.pdf` })}>
                  {ta('downloadPdf')}
                </Button>
              ),
            }))}
          />
        )}
      </Board>

      {outstanding > 0 ? (
        <ActionDock note={`${ta('balance')} · ${money(outstanding)}`}>
          {showApplyCredit ? (
            <Button variant="secondary" onClick={() => (setCreditAmount(String(Math.min(outstanding, availableCredit))), setCreditPreview(null), setCreditOpen(true))}>
              {ta('applyCredit')}
            </Button>
          ) : null}
          <Button onClick={openPay}>{ta('recordPayment')}</Button>
        </ActionDock>
      ) : null}

      <Sheet
        open={payOpen}
        onClose={() => !payMutation.isPending && setPayOpen(false)}
        title={ta('recordPayment')}
        description={`${invoice.number} · ${invoice.customer?.name ?? ''}`}
        tone="success"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={payMutation.isPending} disabled={!(payN > 0)} onClick={() => payMutation.mutate(undefined, { onSuccess: () => setPayOpen(false) })}>
              {ta('recordPayment')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <MoneyField label={ta('amountJod')} currency={tCommon('currency')} size="lg" value={amount === '' ? null : Number(amount)} onChange={(v) => setAmount(v == null ? '' : String(v))} min={0} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAmount(String(outstanding))}>
              {ta('balance')} · {money(outstanding)}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAmount(String(Math.round(outstanding / 2)))}>
              50%
            </Button>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{ta('paymentMethod')}</span>
            <SegmentedControl aria-label={ta('paymentMethod')} value={method} onChange={setMethod} options={methodOptions} />
          </div>
          <DateField label={ta('paymentDate')} value={paymentDate} onChange={setPaymentDate} copy={kit.date} locale={locale} maxDate={todayYmd()} todayShortcut presentation="popover" />
          <Input label={ta('referenceOptional')} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" />
          {payN > 0 ? (
            <Ledger>
              <LedgerRow label={ta('paymentAmount')} value={money(payN)} />
              <LedgerRow label={ta('allocatedToInvoices')} value={money(Math.min(payN, outstanding))} tone="success" stamp />
              <LedgerRow label={ta('addedToAccountCredit')} value={money(Math.max(0, payN - outstanding))} tone={payN > outstanding ? 'info' : undefined} stamp={payN > outstanding} hint={payN > outstanding ? ta('overpayCreditHint') : undefined} />
            </Ledger>
          ) : null}
        </div>
      </Sheet>

      <Sheet
        open={creditOpen}
        onClose={() => !creditBusy && setCreditOpen(false)}
        title={ta('applyCredit')}
        description={ta('applyCreditHint')}
        tone="info"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreditOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="secondary" loading={creditBusy} onClick={() => void previewCredit()}>
              {ta('applyCreditPreview')}
            </Button>
            <Button loading={creditBusy} disabled={!creditPreview || !(creditPreview.applyAmount > 0)} onClick={() => void confirmCredit().then(() => setCreditOpen(false))}>
              {ta('confirmApplyCredit')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Figure value={money(availableCredit)} label={ta('accountCredit')} tone="info" size="sm" locale={locale} />
          <MoneyField label={ta('applyCreditAmount')} currency={tCommon('currency')} value={creditAmount === '' ? null : Number(creditAmount)} onChange={(v) => (setCreditAmount(v == null ? '' : String(v)), setCreditPreview(null))} min={0} max={Math.min(outstanding, availableCredit)} />
          {creditPreview ? (
            <Ledger>
              <LedgerRow label={ta('applyCreditWillApply')} value={money(creditPreview.applyAmount)} tone="info" stamp />
              <LedgerRow label={ta('invoiceRemainingAfter')} value={money(creditPreview.invoiceRemainingAfter)} />
              <LedgerRow label={ta('creditRemainingAfter')} value={money(creditPreview.creditRemainingAfter)} />
            </Ledger>
          ) : null}
        </div>
      </Sheet>
      {pdfDialog}
    </div>
  );
}
