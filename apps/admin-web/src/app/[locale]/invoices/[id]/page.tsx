'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  MotionSection,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
  jofotaraUuid?: string | null;
  jofotaraQr?: string | null;
  jofotaraStatus?: string | null;
  jofotaraClearedAt?: string | null;
  customerId?: string;
  customer?: { id: string; name: string; code?: string };
  salesOrderId?: string | null;
  salesOrder?: {
    id: string;
    number: string;
    status: string;
    externalOrderNumber?: string | null;
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

function qrImageSrc(qr: string): string | null {
  if (qr.startsWith('data:image/')) return qr;
  if (/^[A-Za-z0-9+/=]+$/.test(qr) && qr.length > 100) {
    return `data:image/png;base64,${qr}`;
  }
  return null;
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const ta = useTranslations('accounting');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditPreview, setCreditPreview] = useState<ApplyCreditPreview | null>(null);
  const [creditBusy, setCreditBusy] = useState(false);

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

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title={ta('detail')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

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

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/invoices"
        title={invoice.number}
        description={invoice.customer?.name}
        actions={
          <>
            <StatusBadge status={invoice.status} />
            <Button
              variant="ghost"
              onClick={() => {
                window.open(`${API_URL}/api/v1/invoices/${params.id}/pdf`, '_blank');
              }}
            >
              {ta('downloadPdf')}
            </Button>
          </>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <div className="maher-stagger space-y-6">
      <div className="maher-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{ta('customer')}</p>
          <p className="mt-1 font-semibold">
            {invoice.customer ? (
              <Link
                href={`/customers/${invoice.customer.id}`}
                className="text-brand hover:underline"
              >
                {invoice.customer.name}
              </Link>
            ) : (
              '—'
            )}
          </p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{tSales('systemOrderNumber')}</p>
          <p className="mt-1 font-semibold">
            {invoice.salesOrder ? (
              <Link
                href={`/sales-orders/${invoice.salesOrder.id}`}
                className="text-brand hover:underline"
                dir="ltr"
              >
                {invoice.salesOrder.number}
              </Link>
            ) : (
              '—'
            )}
          </p>
          {invoice.salesOrder?.externalOrderNumber ? (
            <p className="mt-1 text-xs text-text-secondary" dir="ltr">
              {tSales('dealerOrderNumber')}: {invoice.salesOrder.externalOrderNumber}
            </p>
          ) : null}
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{ta('invoiceDate')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {invoice.invoiceDate?.slice(0, 10) ?? '—'}
          </p>
        </Card>
        <Card className="maher-list-card p-4">
          <p className="text-xs text-text-secondary">{ta('dueDate')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {invoice.dueDate?.slice(0, 10) ?? '—'}
          </p>
        </Card>
      </div>

      <MotionSection className="maher-form-section" as="div">
      <Card title={ta('jofotara')} className="space-y-3">
        {invoice.jofotaraUuid || invoice.jofotaraStatus || invoice.jofotaraQr ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-secondary">{ta('jofotaraUuid')}</dt>
              <dd className="mt-1 break-all font-mono text-sm" dir="ltr">
                {invoice.jofotaraUuid ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">{ta('jofotaraStatus')}</dt>
              <dd className="mt-1 font-semibold" dir="ltr">
                {invoice.jofotaraStatus ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">{ta('jofotaraClearedAt')}</dt>
              <dd className="mt-1 font-semibold" dir="ltr">
                {invoice.jofotaraClearedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-2 text-xs text-text-secondary">{ta('jofotaraQr')}</dt>
              <dd>
                {invoice.jofotaraQr ? (
                  (() => {
                    const imgSrc = qrImageSrc(invoice.jofotaraQr);
                    return imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={ta('jofotaraQr')}
                        className="h-32 w-32 rounded border border-[var(--maher-border)] bg-white p-2"
                      />
                    ) : (
                      <p className="break-all rounded border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-2 font-mono text-xs" dir="ltr">
                        {invoice.jofotaraQr}
                      </p>
                    );
                  })()
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <EmptyState title={ta('jofotaraNotCleared')} description={ta('jofotaraNotClearedHint')} />
        )}
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card title={ta('total')} className="space-y-0">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-xs text-text-secondary">{ta('subtotal')}</dt>
            <dd className="mt-1 font-semibold" dir="ltr">
              {money(invoice.subtotal)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{ta('tax')}</dt>
            <dd className="mt-1 font-semibold" dir="ltr">
              {money(invoice.taxTotal)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{ta('total')}</dt>
            <dd className="mt-1 font-semibold" dir="ltr">
              {money(invoice.total)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{ta('paidAmount')}</dt>
            <dd className="mt-1 font-semibold" dir="ltr">
              {money(invoice.paidAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{ta('balance')}</dt>
            <dd className="mt-1 font-semibold" dir="ltr">
              {money(invoice.outstandingAmount)}
            </dd>
          </div>
        </dl>
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card title={ta('lines')}>
        {lines.length === 0 ? (
          <EmptyState title={ta('noLines')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta('description')}</TableHeaderCell>
                <TableHeaderCell>{ta('qty')}</TableHeaderCell>
                <TableHeaderCell>{ta('unitPrice')}</TableHeaderCell>
                <TableHeaderCell>{ta('lineTotal')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableNumericCell>{Number(line.quantity)}</TableNumericCell>
                  <TableNumericCell>{money(line.unitPrice)}</TableNumericCell>
                  <TableNumericCell>{money(line.lineTotal)}</TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card title={ta('paymentHistory')}>
        {payments.length === 0 ? (
          <EmptyState title={ta('noPayments')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta('paymentNumber')}</TableHeaderCell>
                <TableHeaderCell>{ta('paymentDate')}</TableHeaderCell>
                <TableHeaderCell>{ta('paymentMethod')}</TableHeaderCell>
                <TableHeaderCell>{ta('reference')}</TableHeaderCell>
                <TableHeaderCell>{ta('amount')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.number}</TableCell>
                  <TableNumericCell>{p.paymentDate?.slice(0, 10) ?? '—'}</TableNumericCell>
                  <TableCell>
                    {ta(`method${p.method}` as 'methodCASH')}
                  </TableCell>
                  <TableNumericCell>{p.referenceNumber ?? '—'}</TableNumericCell>
                  <TableNumericCell>{money(p.amount)}</TableNumericCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        window.open(`${API_URL}/api/v1/payments/${p.id}/pdf`, '_blank');
                      }}
                    >
                      {ta('downloadPdf')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      </MotionSection>

      {outstanding > 0 ? (
        <MotionSection className="maher-form-section" as="div">
        <Card title={ta('recordPayment')}>
          <div className="grid max-w-xl gap-3">
            <Input
              label={ta('amountJod')}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(outstanding)}
            />
            <Select
              label={ta('paymentMethod')}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={methodOptions}
            />
            <Input
              label={ta('referenceOptional')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            {payN > 0 ? (
              <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm space-y-1">
                <p className="flex justify-between gap-3">
                  <span className="text-text-secondary">{ta('paymentAmount')}</span>
                  <span className="tabular-nums font-medium" dir="ltr">
                    {money(payN)}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-text-secondary">{ta('allocatedToInvoices')}</span>
                  <span className="tabular-nums font-medium" dir="ltr">
                    {money(Math.min(payN, outstanding))}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-text-secondary">{ta('addedToAccountCredit')}</span>
                  <span className="tabular-nums font-medium" dir="ltr">
                    {money(Math.max(0, payN - outstanding))}
                  </span>
                </p>
                {payN > outstanding ? (
                  <p className="text-xs text-text-tertiary pt-1">{ta('overpayCreditHint')}</p>
                ) : null}
              </div>
            ) : null}
            <div className="maher-detail-sticky-actions">
              <Button loading={payMutation.isPending} onClick={() => payMutation.mutate()}>
                {ta('recordPayment')}
              </Button>
            </div>
          </div>
        </Card>
        </MotionSection>
      ) : null}

      {showApplyCredit ? (
        <MotionSection className="maher-form-section" as="div">
        <Card title={ta('applyCredit')}>
          <div className="grid max-w-xl gap-3">
            <p className="text-sm text-text-secondary">{ta('applyCreditHint')}</p>
            <p className="text-sm flex justify-between gap-3">
              <span className="text-text-secondary">{ta('accountCredit')}</span>
              <span className="tabular-nums font-semibold" dir="ltr">
                {money(availableCredit)}
              </span>
            </p>
            <Input
              label={ta('applyCreditAmount')}
              type="number"
              value={creditAmount}
              onChange={(e) => {
                setCreditAmount(e.target.value);
                setCreditPreview(null);
              }}
              placeholder={String(Math.min(outstanding, availableCredit))}
            />
            {creditPreview ? (
              <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm space-y-1">
                <p className="text-xs font-semibold text-brand">{ta('applyCreditPreview')}</p>
                <p className="flex justify-between gap-3">
                  <span className="text-text-secondary">{ta('applyCreditWillApply')}</span>
                  <span className="tabular-nums font-medium" dir="ltr">
                    {money(creditPreview.applyAmount)}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-text-secondary">{ta('invoiceRemainingAfter')}</span>
                  <span className="tabular-nums font-medium" dir="ltr">
                    {money(creditPreview.invoiceRemainingAfter)}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-text-secondary">{ta('creditRemainingAfter')}</span>
                  <span className="tabular-nums font-medium" dir="ltr">
                    {money(creditPreview.creditRemainingAfter)}
                  </span>
                </p>
              </div>
            ) : null}
            <div className="maher-detail-sticky-actions flex flex-wrap gap-2">
              <Button variant="secondary" loading={creditBusy} onClick={() => void previewCredit()}>
                {ta('applyCreditPreview')}
              </Button>
              <Button
                loading={creditBusy}
                disabled={!creditPreview || !(creditPreview.applyAmount > 0)}
                onClick={() => void confirmCredit()}
              >
                {ta('confirmApplyCredit')}
              </Button>
            </div>
          </div>
        </Card>
        </MotionSection>
      ) : null}
      </div>
    </div>
  );
}
