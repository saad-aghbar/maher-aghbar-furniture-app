'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CancelImpactSheet } from '@/components/sales-orders/cancel-impact-sheet';
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
  PageHero,
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
  Ltr,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  externalOrderNumber?: string | null;
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

function canOpenCancel(status: string) {
  return status !== 'CANCELLED';
}

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
  const [financeAttention, setFinanceAttention] = useState(false);
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
    placeholderData: keepPreviousData,
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

  const statusFilterOptions = statusOptions(tStatus, SALES_ORDER_STATUSES, {
    label: tCommon('all'),
  });

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listQuery.isError && !listQuery.data) {
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
      <PageHero title={t('salesOrders')} description={tSales('emptyHint')} tone="soft" />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {financeAttention ? (
        <Alert variant="warning">
          <p className="font-medium">{tSales('cancelImpact.financialAttentionBannerTitle')}</p>
          <p className="mt-1 text-sm">{tSales('cancelImpact.financialAttentionBannerBody')}</p>
        </Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Input
            withSearchIcon
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
                <TableHeaderCell>{tSales('systemOrderNumber')}</TableHeaderCell>
                <TableHeaderCell>{tSales('dealerOrderNumber')}</TableHeaderCell>
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
                  <TableNumericCell>
                    <Link
                      href={`/sales-orders/${row.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      <Ltr>{row.number}</Ltr>
                    </Link>
                  </TableNumericCell>
                  <TableNumericCell>{row.externalOrderNumber?.trim() || '—'}</TableNumericCell>
                  <TableCell>
                    {row.customer ? localizedName(locale, row.customer, row.customer.name) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableNumericCell>{Number(row.total ?? 0).toFixed(2)}</TableNumericCell>
                  <TableNumericCell>
                    {row.requestedDeliveryDate
                      ? row.requestedDeliveryDate.slice(0, 10)
                      : '—'}
                  </TableNumericCell>
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
                      {canOpenCancel(row.status) ? (
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
      <CancelImpactSheet
        open={Boolean(cancelId)}
        salesOrderId={cancelId}
        onClose={() => setCancelId(null)}
        onCancelled={({ financialAttention }) => {
          setBanner(tSales('cancelledBanner'));
          setFinanceAttention(financialAttention);
        }}
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
