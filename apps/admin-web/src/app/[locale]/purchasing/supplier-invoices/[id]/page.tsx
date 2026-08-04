'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
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
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;

interface SupplierInvoiceDetail {
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
  supplierId: string;
  supplier?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null };
  purchaseOrder?: { id: string; number: string; status: string } | null;
  lines?: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
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
}

function money(value: string | number | undefined | null) {
  return Number(value ?? 0).toFixed(2);
}

export default function SupplierInvoiceDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const detailQuery = useQuery({
    queryKey: ['supplier-invoice', params.id],
    queryFn: () =>
      apiFetch<SupplierInvoiceDetail>(`/api/v1/supplier-invoices/${params.id}`),
  });

  const payMutation = useMutation({
    mutationFn: () => {
      const inv = detailQuery.data;
      if (!inv) throw new Error('missing');
      return apiFetch('/api/v1/supplier-payments', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: inv.supplierId,
          supplierInvoiceId: inv.id,
          amount: Number(amount),
          method,
          referenceNumber: reference.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setBanner(tc('supplierPaymentRecorded'));
      setAmount('');
      setReference('');
      setError(null);
      await qc.invalidateQueries({ queryKey: ['supplier-invoice', params.id] });
      await qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

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
        title={tc('supplierInvoiceDetail')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const inv = detailQuery.data;
  const outstanding = Number(inv.outstandingAmount ?? 0);
  const canPay = outstanding > 0 && !['VOID', 'CANCELLED', 'PAID'].includes(inv.status);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/purchasing"
        title={inv.number}
        description={
          inv.supplier ? localizedName(locale, inv.supplier, inv.supplier.name) : undefined
        }
        actions={<StatusBadge status={inv.status} />}
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card title={tCommon('total')}>
          <p className="text-lg font-semibold" dir="ltr">
            {money(inv.total)} {inv.currency ?? ''}
          </p>
        </Card>
        <Card title={tc('paid')}>
          <p className="text-lg font-semibold" dir="ltr">
            {money(inv.paidAmount)}
          </p>
        </Card>
        <Card title={tc('outstanding')}>
          <p className="text-lg font-semibold" dir="ltr">
            {money(inv.outstandingAmount)}
          </p>
        </Card>
        <Card title={tc('purchaseOrder')}>
          {inv.purchaseOrder ? (
            <Link
              href={`/purchasing/${inv.purchaseOrder.id}`}
              className="font-medium text-brand hover:underline"
            >
              <span dir="ltr">{inv.purchaseOrder.number}</span>
            </Link>
          ) : (
            '—'
          )}
        </Card>
      </div>

      <Card title={tc('lines')}>
        {(inv.lines ?? []).length === 0 ? (
          <EmptyState title={tc('empty')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('description')}</TableHeaderCell>
                <TableHeaderCell>{tc('qty')}</TableHeaderCell>
                <TableHeaderCell>{tc('unitPrice')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(inv.lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableNumericCell>{String(line.quantity)}</TableNumericCell>
                  <TableNumericCell>{money(line.unitPrice)}</TableNumericCell>
                  <TableNumericCell>{money(line.lineTotal)}</TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {canPay ? (
        <Card title={tc('recordSupplierPayment')}>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              label={tc('amount')}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
            />
            <Select
              label={tc('paymentMethod')}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Input
              label={tc('reference')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              dir="ltr"
            />
            <div className="flex items-end">
              <Button
                loading={payMutation.isPending}
                disabled={!amount || Number(amount) <= 0}
                onClick={() => payMutation.mutate()}
              >
                {tc('recordSupplierPayment')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card title={tc('payments')}>
        {(inv.payments ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">—</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                <TableHeaderCell>{tc('amount')}</TableHeaderCell>
                <TableHeaderCell>{tc('paymentMethod')}</TableHeaderCell>
                <TableHeaderCell>{tc('reference')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(inv.payments ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span dir="ltr">{p.number}</span>
                  </TableCell>
                  <TableNumericCell>{money(p.amount)}</TableNumericCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{p.referenceNumber ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
