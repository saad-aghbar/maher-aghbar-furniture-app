'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { SALES_ORDER_STATUSES, statusOptions } from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Select,
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
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface Row {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  projectName?: string | null;
  requestedDeliveryDate?: string | null;
  customer?: {
    id: string;
    name: string;
    code?: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  quotation?: { id: string; number: string } | null;
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

function SalesOrdersPageInner() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('status') ?? '';
    setStatus(fromUrl);
    setPage(1);
  }, [searchParams]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [q, status, page]);

  const listQuery = useQuery({
    queryKey: ['sales-orders', listParams],
    queryFn: () =>
      apiFetch<{ data: Row[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/sales-orders?${listParams}`,
      ),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/sales-orders/${id}/confirm`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      setBanner(tSales('confirmedBanner'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const holdMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/api/v1/sales-orders/${id}/hold`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setError(null);
      setHoldId(null);
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setBanner(tSales('heldBanner'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/api/v1/sales-orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setError(null);
      setCancelId(null);
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setBanner(tSales('cancelledBanner'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const statusFilterOptions = statusOptions(tStatus, SALES_ORDER_STATUSES, {
    label: tCommon('all'),
  });

  if (listQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listQuery.isError) {
    return (
      <ErrorState
        title={t('salesOrders')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title={t('salesOrders')} description={tSales('emptyHint')} />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            className="ps-9"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={tSales('searchPlaceholder')}
          />
        </label>
        <Select
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
        <EmptyState title={tSales('empty')} description={tSales('emptyHint')} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tSales('number')}</TableHeaderCell>
                <TableHeaderCell>{tSales('customer')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                <TableHeaderCell>{tSales('total')}</TableHeaderCell>
                <TableHeaderCell>{tSales('deliveryDate')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/sales-orders/${row.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {row.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.customer ? localizedName(locale, row.customer, row.customer.name) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell dir="ltr">{Number(row.total ?? 0).toFixed(2)}</TableCell>
                  <TableCell dir="ltr">
                    {row.requestedDeliveryDate
                      ? row.requestedDeliveryDate.slice(0, 10)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {row.status === 'DRAFT' ? (
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => setConfirmId(row.id)}
                        >
                          {tSales('confirmToProduction')}
                        </Button>
                      ) : null}
                      {HOLDABLE.includes(row.status) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setHoldId(row.id)}
                        >
                          {tSales('hold')}
                        </Button>
                      ) : null}
                      {CANCELLABLE.includes(row.status) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelId(row.id)}
                        >
                          {tSales('cancelOrder')}
                        </Button>
                      ) : null}
                      <Link
                        href={`/sales-orders/${row.id}`}
                        className="text-sm text-brand hover:underline"
                      >
                        {tCommon('details')}
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
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
                variant="ghost"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tCommon('next')}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmId)}
        title={tSales('confirm')}
        description={tSales('confirmDescription')}
        confirmLabel={tSales('confirm')}
        loading={confirmMutation.isPending}
        error={error}
        onConfirm={() => {
          if (confirmId) confirmMutation.mutate(confirmId);
        }}
        onClose={() => setConfirmId(null)}
      />
      <ConfirmDialog
        open={Boolean(holdId)}
        title={tSales('hold')}
        description={tSales('holdDescription')}
        confirmLabel={tSales('hold')}
        withReason
        reasonLabel={tCommon('reason')}
        loading={holdMutation.isPending}
        error={error}
        onConfirm={(reason) => {
          if (holdId) holdMutation.mutate({ id: holdId, reason });
        }}
        onClose={() => setHoldId(null)}
      />
      <ConfirmDialog
        open={Boolean(cancelId)}
        title={tSales('cancelOrder')}
        description={tSales('cancelDescription')}
        confirmLabel={tSales('cancelOrder')}
        danger
        withReason
        reasonLabel={tCommon('reason')}
        loading={cancelMutation.isPending}
        error={error}
        onConfirm={(reason) => {
          if (cancelId) cancelMutation.mutate({ id: cancelId, reason });
        }}
        onClose={() => setCancelId(null)}
      />
    </div>
  );
}

export default function SalesOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SalesOrdersPageInner />
    </Suspense>
  );
}
