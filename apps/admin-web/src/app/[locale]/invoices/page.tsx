'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError, API_URL } from '@/lib/api-client';
import { INVOICE_STATUSES, statusOptions } from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
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

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  outstandingAmount?: string | number;
  dueDate?: string | null;
  customerId?: string;
  customer?: { id: string; name: string };
}

interface SalesOrderRow {
  id: string;
  number: string;
  status: string;
  customer?: { name: string };
}

function isOverdue(row: InvoiceRow) {
  if (row.status === 'OVERDUE') return true;
  if (!row.dueDate) return false;
  if (!(Number(row.outstandingAmount) > 0)) return false;
  return new Date(row.dueDate).getTime() < Date.now();
}

function InvoicesPageInner() {
  const t = useTranslations('navigation');
  const ta = useTranslations('accounting');
  const tc = useTranslations('catalog');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('status') ?? '';
    setStatus(fromUrl);
    setPage(1);
  }, [searchParams]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [q, status, page]);

  const listQuery = useQuery({
    queryKey: ['invoices', listParams],
    queryFn: () =>
      apiFetch<{ data: InvoiceRow[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/invoices?${listParams}`,
      ),
  });

  const soQuery = useQuery({
    queryKey: ['sales-orders-for-invoice'],
    queryFn: () =>
      apiFetch<{ data: SalesOrderRow[] }>('/api/v1/sales-orders?pageSize=50').then((r) => r.data),
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!salesOrderId) throw new ApiClientError(tc('selectSalesOrder'), 400);
      return apiFetch('/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({ salesOrderId }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCreateOpen(false);
      setBanner(ta('invoiceCreated'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const statusFilterOptions = statusOptions(tStatus, INVOICE_STATUSES, {
    label: tCommon('all'),
  });

  const rows = listQuery.data?.data ?? [];

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
        title={t('invoices')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const meta = listQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('invoices')}
        description={ta('emptyHint')}
        actions={
          <Button
            onClick={() => {
              setSalesOrderId('');
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            {ta('createFromSalesOrder')}
          </Button>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}

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
            placeholder={ta('searchPlaceholder')}
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
        <EmptyState title={ta('empty')} description={ta('emptyHint')} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta('invoiceNumber')}</TableHeaderCell>
                <TableHeaderCell>{tc('customer')}</TableHeaderCell>
                <TableHeaderCell>{ta('amount')}</TableHeaderCell>
                <TableHeaderCell>{ta('outstanding')}</TableHeaderCell>
                <TableHeaderCell>{ta('dueDate')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const overdue = isOverdue(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${row.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {row.number}
                      </Link>
                    </TableCell>
                    <TableCell>{row.customer?.name ?? '—'}</TableCell>
                    <TableCell dir="ltr">{Number(row.total ?? 0).toFixed(2)}</TableCell>
                    <TableCell dir="ltr">{Number(row.outstandingAmount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <span dir="ltr">{row.dueDate ? row.dueDate.slice(0, 10) : '—'}</span>
                      {overdue ? (
                        <span className="ms-2 text-xs font-medium text-red-600">
                          {ta('overdueHint')}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/invoices/${row.id}`}
                          className="text-sm text-brand hover:underline"
                        >
                          {ta('viewDetails')}
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            window.open(`${API_URL}/api/v1/invoices/${row.id}/pdf`, '_blank');
                          }}
                        >
                          {tc('pdf')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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

      <Modal
        open={createOpen}
        onClose={() => !createMutation.isPending && setCreateOpen(false)}
        title={ta('createInvoice')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={createMutation.isPending}
              onClick={() => setCreateOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={tc('salesOrder')}
            value={salesOrderId}
            onChange={(e) => setSalesOrderId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {(soQuery.data ?? []).map((so) => (
              <option key={so.id} value={so.id}>
                {so.number} — {so.customer?.name ?? tStatus(so.status as never)}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <InvoicesPageInner />
    </Suspense>
  );
}
