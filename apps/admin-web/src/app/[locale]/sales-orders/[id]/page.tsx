'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
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
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface SalesOrderDetail {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  projectName?: string | null;
  requestedDeliveryDate?: string | null;
  createdAt?: string;
  customer?: {
    id: string;
    name: string;
    code?: string;
    phone?: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  quotation?: { id: string; number: string; status: string } | null;
  lines?: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
  }>;
  productionOrders?: Array<{
    id: string;
    number: string;
    status: string;
    progressPercent?: number | null;
    currentStageCode?: string | null;
  }>;
  invoices?: Array<{
    id: string;
    number: string;
    status: string;
    total?: string | number;
    outstandingAmount?: string | number;
  }>;
  deliveries?: Array<{
    id: string;
    number: string;
    status: string;
    deliveryDate?: string | null;
  }>;
  contracts?: Array<{
    id: string;
    number: string;
    status: string;
    contractValue?: string | number;
  }>;
}

const HOLDABLE = [
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'IN_PRODUCTION',
  'WAITING_FOR_MATERIALS',
  'WAITING_FOR_PAYMENT',
];
const CANCELLABLE = [
  'DRAFT',
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
];

export default function SalesOrderDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tCatalog = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['sales-order', params.id],
    queryFn: () => apiFetch<SalesOrderDetail>(`/api/v1/sales-orders/${params.id}`),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/sales-orders/${params.id}/confirm`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirmOpen(false);
      setBanner(tSales('confirmedBanner'));
      await queryClient.invalidateQueries({ queryKey: ['sales-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const holdMutation = useMutation({
    mutationFn: (reason?: string) =>
      apiFetch(`/api/v1/sales-orders/${params.id}/hold`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setError(null);
      setHoldOpen(false);
      setBanner(tSales('heldBanner'));
      await queryClient.invalidateQueries({ queryKey: ['sales-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) =>
      apiFetch(`/api/v1/sales-orders/${params.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setError(null);
      setCancelOpen(false);
      setBanner(tSales('cancelledBanner'));
      await queryClient.invalidateQueries({ queryKey: ['sales-order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
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
        title={tSales('detail')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const order = detailQuery.data;
  const lines = order.lines ?? [];
  const customerName = order.customer
    ? localizedName(locale, order.customer, order.customer.name)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.number}
        description={customerName}
        actions={
          <>
            <StatusBadge status={order.status} />
            {order.status === 'DRAFT' ? (
              <Button onClick={() => setConfirmOpen(true)}>{tSales('confirm')}</Button>
            ) : null}
            {HOLDABLE.includes(order.status) ? (
              <Button variant="secondary" onClick={() => setHoldOpen(true)}>
                {tSales('hold')}
              </Button>
            ) : null}
            {CANCELLABLE.includes(order.status) ? (
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                {tSales('cancelOrder')}
              </Button>
            ) : null}
          </>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tSales('customer')}</p>
          <p className="mt-1 font-semibold">
            {order.customer ? (
              <Link href={`/customers/${order.customer.id}`} className="text-brand hover:underline">
                {customerName}
              </Link>
            ) : (
              '—'
            )}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tSales('total')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {Number(order.total ?? 0).toFixed(2)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tSales('deliveryDate')}</p>
          <p className="mt-1 font-semibold" dir="ltr">
            {order.requestedDeliveryDate?.slice(0, 10) ?? '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tSales('quotation')}</p>
          <p className="mt-1 font-semibold">
            {order.quotation ? (
              <Link
                href={`/quotations/${order.quotation.id}`}
                className="text-brand hover:underline"
              >
                {order.quotation.number}
              </Link>
            ) : (
              '—'
            )}
          </p>
        </Card>
      </div>

      {order.projectName ? (
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tSales('project')}</p>
          <p className="mt-1 font-medium">{order.projectName}</p>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">{tSales('lines')}</h2>
        {lines.length === 0 ? (
          <EmptyState title={tSales('noLines')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tSales('description')}</TableHeaderCell>
                <TableHeaderCell>{tCatalog('qty')}</TableHeaderCell>
                <TableHeaderCell>{tSales('unitPrice')}</TableHeaderCell>
                <TableHeaderCell>{tSales('lineTotal')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell dir="ltr">{Number(line.quantity)}</TableCell>
                  <TableCell dir="ltr">{Number(line.unitPrice).toFixed(2)}</TableCell>
                  <TableCell dir="ltr">{Number(line.lineTotal).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <LinkedSection
        title={tSales('linkedContracts')}
        empty={tCatalog('noContracts')}
        rows={(order.contracts ?? []).map((c) => ({
          id: c.id,
          href: '/contracts',
          number: c.number,
          status: c.status,
          meta: c.contractValue != null ? Number(c.contractValue).toFixed(2) : undefined,
        }))}
      />

      <LinkedSection
        title={tSales('linkedProduction')}
        empty={tSales('noProductionYet')}
        rows={(order.productionOrders ?? []).map((po) => ({
          id: po.id,
          href: `/production/${po.id}`,
          number: po.number,
          status: po.status,
          meta: po.progressPercent != null ? `${Number(po.progressPercent)}%` : undefined,
        }))}
      />

      <LinkedSection
        title={tSales('linkedInvoices')}
        empty={tNav('invoices')}
        rows={(order.invoices ?? []).map((inv) => ({
          id: inv.id,
          href: `/invoices/${inv.id}`,
          number: inv.number,
          status: inv.status,
          meta: inv.total != null ? Number(inv.total).toFixed(2) : undefined,
        }))}
      />

      <LinkedSection
        title={tSales('linkedDeliveries')}
        empty={tNav('deliveries')}
        rows={(order.deliveries ?? []).map((d) => ({
          id: d.id,
          href: `/deliveries/${d.id}`,
          number: d.number,
          status: d.status,
          meta: d.deliveryDate?.slice(0, 10),
        }))}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={tSales('confirm')}
        description={tSales('confirmDescription')}
        confirmLabel={tSales('confirm')}
        loading={confirmMutation.isPending}
        error={error}
        onConfirm={() => confirmMutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={holdOpen}
        title={tSales('hold')}
        description={tSales('holdDescription')}
        confirmLabel={tSales('hold')}
        withReason
        reasonLabel={tCommon('reason')}
        loading={holdMutation.isPending}
        error={error}
        onConfirm={(reason) => holdMutation.mutate(reason)}
        onClose={() => setHoldOpen(false)}
      />
      <ConfirmDialog
        open={cancelOpen}
        title={tSales('cancelOrder')}
        description={tSales('cancelDescription')}
        confirmLabel={tSales('cancelOrder')}
        danger
        withReason
        reasonLabel={tCommon('reason')}
        loading={cancelMutation.isPending}
        error={error}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}

function LinkedSection({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; href: string; number: string; status: string; meta?: string }>;
}) {
  const tCommon = useTranslations('common');
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{empty}</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('details')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={row.href} className="font-medium text-brand hover:underline">
                    {row.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell dir="ltr">{row.meta ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
