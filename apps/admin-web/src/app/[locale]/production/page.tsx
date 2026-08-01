'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { PRODUCTION_STATUSES, statusOptions } from '@/lib/status-options';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface Row {
  id: string;
  number: string;
  productDescription: string;
  status: string;
  progressPercent: number;
  currentStageCode?: string | null;
  salesOrder?: { number: string } | null;
}

function ProductionPageInner() {
  const t = useTranslations('navigation');
  const tp = useTranslations('production');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startId, setStartId] = useState<string | null>(null);

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
    queryKey: ['production-orders', listParams],
    queryFn: () =>
      apiFetch<{ data: Row[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/production-orders?${listParams}`,
      ),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/production-orders/${id}/start`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      setStartId(null);
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      setBanner(tc('productionStarted'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const statusFilterOptions = statusOptions(tStatus, PRODUCTION_STATUSES, {
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
        title={t('production')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title={t('production')} />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error && !startId ? <Alert variant="error">{error}</Alert> : null}

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
            placeholder={tp('searchPlaceholder')}
          />
        </label>
        <Select
          label={tCommon('status')}
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
        <EmptyState title={tp('emptyOrders')} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                <TableHeaderCell>{tc('salesOrder')}</TableHeaderCell>
                <TableHeaderCell>{tc('product')}</TableHeaderCell>
                <TableHeaderCell>{tc('currentStage')}</TableHeaderCell>
                <TableHeaderCell>{tc('progress')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/production/${row.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {row.number}
                    </Link>
                  </TableCell>
                  <TableCell>{row.salesOrder?.number ?? '—'}</TableCell>
                  <TableCell>{row.productDescription}</TableCell>
                  <TableCell>{row.currentStageCode ?? '—'}</TableCell>
                  <TableCell dir="ltr">{row.progressPercent}%</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/production/${row.id}`}>
                        <Button size="sm" variant="subtle">
                          {tCommon('details')}
                        </Button>
                      </Link>
                      {row.status === 'DRAFT' ||
                      row.status === 'PLANNED' ||
                      row.status === 'READY' ||
                      row.status === 'WAITING_FOR_MATERIALS' ? (
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setError(null);
                            setStartId(row.id);
                          }}
                        >
                          {tp('start')}
                        </Button>
                      ) : null}
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
        open={Boolean(startId)}
        title={tp('startConfirmTitle')}
        description={tp('startConfirmDescription')}
        confirmLabel={tp('start')}
        loading={startMutation.isPending}
        error={error}
        onConfirm={() => {
          if (startId) startMutation.mutate(startId);
        }}
        onClose={() => {
          setStartId(null);
          setError(null);
        }}
      />
    </div>
  );
}

export default function ProductionPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ProductionPageInner />
    </Suspense>
  );
}
