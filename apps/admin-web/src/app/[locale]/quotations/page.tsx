'use client';

import {
  LineItemsEditor,
  emptyLineItem,
  serializeLineItems,
  type LineItemDraft,
} from '@/components/admin/line-items-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { QUOTATION_STATUSES, statusOptions } from '@/lib/status-options';
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
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface QuotationRow {
  id: string;
  number: string;
  total?: string | number;
  status: string;
  expirationDate?: string | null;
  customer?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
}

interface Customer {
  id: string;
  name: string;
  code: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

function QuotationsPageInner() {
  const locale = useLocale();
  const t = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fromUrl = searchParams.get('status') ?? '';
    setStatus(fromUrl);
    setPage(1);
  }, [searchParams]);
  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState('0.16');

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (filterCustomerId) params.set('customerId', filterCustomerId);
    return params.toString();
  }, [q, status, filterCustomerId, page]);

  const listQuery = useQuery({
    queryKey: ['quotations', listParams],
    queryFn: () =>
      apiFetch<{ data: QuotationRow[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/quotations?${listParams}`,
      ),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-pick-quote'],
    queryFn: () =>
      apiFetch<{ data: Customer[] }>('/api/v1/customers?pageSize=100').then((r) => r.data),
  });

  const resetForm = () => {
    setCustomerId('');
    setLines([emptyLineItem()]);
    setPaymentTerms('');
    setDeliveryTerms('');
    setNotes('');
    setTaxRate('0.16');
    setFormError(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payloadLines = serializeLineItems(lines).map((line) => ({
        ...line,
        taxRate: Number(taxRate) || 0,
        discountType: 'NONE' as const,
        discountValue: 0,
      }));
      if (!customerId || payloadLines.length === 0) {
        throw new ApiClientError(t('validationCustomerLines'), 400);
      }
      if (
        payloadLines.some(
          (line) => !(line.quantity > 0) || Number(line.unitPrice ?? 0) < 0,
        )
      ) {
        throw new ApiClientError(t('validationLineValues'), 400);
      }
      return apiFetch<{ id: string }>('/api/v1/quotations', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          paymentTerms: paymentTerms.trim() || undefined,
          deliveryTerms: deliveryTerms.trim() || undefined,
          customerNotes: notes.trim() || undefined,
          lines: payloadLines,
        }),
      });
    },
    onSuccess: async (created) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setCreateOpen(false);
      resetForm();
      setBanner(t('created'));
      router.push(`/quotations/${created.id}`);
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const statusFilterOptions = statusOptions(tStatus, QUOTATION_STATUSES, {
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
        title={tNav('quotations')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <Button
            type="button"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="me-1 h-4 w-4" />
            {t('create')}
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
            placeholder={t('searchPlaceholder')}
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
        <Select
          value={filterCustomerId}
          onChange={(e) => {
            setPage(1);
            setFilterCustomerId(e.target.value);
          }}
          className="w-56"
        >
          <option value="">{t('customer')} — {tCommon('all')}</option>
          {(customersQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {localizedName(locale, c, c.name)}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('number')}</TableHeaderCell>
                <TableHeaderCell>{t('customer')}</TableHeaderCell>
                <TableHeaderCell>{t('total')}</TableHeaderCell>
                <TableHeaderCell>{t('validUntil')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/quotations/${row.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {row.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.customer
                      ? localizedName(locale, row.customer, row.customer.name)
                      : '—'}
                  </TableCell>
                  <TableCell dir="ltr">
                    {Number(row.total ?? 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {tCommon('currency')}
                  </TableCell>
                  <TableCell dir="ltr">
                    {row.expirationDate ? row.expirationDate.slice(0, 10) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
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

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('create')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={t('customer')}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {(customersQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {localizedName(locale, c, c.name)}
              </option>
            ))}
          </Select>

          <LineItemsEditor lines={lines} onChange={setLines} showUnitPrice />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label={tc('taxRate')}
              type="number"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
            <Input
              label={tc('paymentTerms')}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
            <Input
              label={tc('deliveryTerms')}
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
            />
            <Input
              label={tc('notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <QuotationsPageInner />
    </Suspense>
  );
}
