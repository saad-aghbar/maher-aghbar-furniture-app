'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Card, Skeleton, ErrorState, StatusBadge, Button, Alert, Table, TableBody, TableCell,
  TableNumericCell, TableHead, TableHeaderCell, TableRow, MotionSection } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { localizedName } from '@maher/i18n';

interface QuoteLine {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  discountValue?: number | string | null;
  taxRate?: number | string | null;
}

interface QuotationDetail {
  id: string;
  number: string;
  total: number | string;
  status: string;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
  customer?: {
    id?: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  pendingApproverRole?: string | null;
  approvalChain?: string[];
  completedApprovalSteps?: string[];
  lines?: QuoteLine[];
  request?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
}

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quotation', params.id],
    queryFn: () => apiFetch<QuotationDetail>(`/api/v1/quotations/${params.id}`),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/quotations/${params.id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      setMessage(t('approve'));
      queryClient.invalidateQueries({ queryKey: ['quotation', params.id] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/quotations/${params.id}/submit-for-approval`, { method: 'POST' }),
    onSuccess: () => {
      setMessage(tc('submittedForApproval'));
      queryClient.invalidateQueries({ queryKey: ['quotation', params.id] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/quotations/${params.id}/send`, { method: 'POST' }),
    onSuccess: () => {
      setMessage(t('send'));
      queryClient.invalidateQueries({ queryKey: ['quotation', params.id] });
    },
  });

  const reviseMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/v1/quotations/${params.id}/revise`, { method: 'POST' }),
    onSuccess: (revised) => {
      setMessage(tc('revisionCreated'));
      router.push(`/quotations/${revised.id}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/quotations/${params.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setMessage(t('reject'));
      queryClient.invalidateQueries({ queryKey: ['quotation', params.id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) {
    return (
      <ErrorState title={t('detail')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />
    );
  }

  const canReject = ['INTERNAL_REVIEW', 'APPROVED'].includes(data.status);
  const customerLabel = data.customer
    ? localizedName(locale, data.customer, data.customer.name)
    : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/orders"
        title={data.number}
        description={customerLabel}
        actions={<StatusBadge status={data.status} />}
      />
      {message ? <Alert variant="success">{message}</Alert> : null}
      {data.pendingApproverRole ? (
        <Alert variant="info">
          {tc('pendingApproval')}
        </Alert>
      ) : null}
      <div className="maher-stagger space-y-6">
      <MotionSection className="maher-form-section" as="div">
      <Card title={t('detail')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('customer')}</dt>
            <dd className="font-medium">
              {data.customer?.id ? (
                <Link href={`/customers/${data.customer.id}`} className="text-brand hover:underline">
                  {customerLabel}
                </Link>
              ) : (
                customerLabel
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('total')}</dt>
            <dd className="font-medium" dir="ltr">
              {Number(data.total).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {tCommon('currency')}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{tc('paymentTerms')}</dt>
            <dd className="font-medium">{data.paymentTerms ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{tc('deliveryTerms')}</dt>
            <dd className="font-medium">{data.deliveryTerms ?? '—'}</dd>
          </div>
          {data.request ? (
            <div>
              <dt className="text-sm text-[var(--maher-text-secondary)]">{tc('rfq')}</dt>
              <dd>
                <Link href={`/requests/${data.request.id}`} className="font-medium text-brand hover:underline">
                  {data.request.number}
                </Link>
              </dd>
            </div>
          ) : null}
          {data.request?.externalOrderNumber ? (
            <div>
              <dt className="text-sm text-[var(--maher-text-secondary)]">
                {tSales('dealerOrderNumber')}
              </dt>
              <dd className="font-medium" dir="ltr">
                {data.request.externalOrderNumber}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="maher-detail-sticky-actions mt-6 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
              window.open(`${API}/api/v1/quotations/${params.id}/pdf`, '_blank');
            }}
          >
            {tc('pdf')}
          </Button>
          {data.status === 'DRAFT' ? (
            <Button
              onClick={() => submitMutation.mutate()}
              loading={submitMutation.isPending}
            >
              {tc('submitForApproval')}
            </Button>
          ) : null}
          {data.status === 'INTERNAL_REVIEW' ? (
            <Button onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
              {t('approveQuotation')}
            </Button>
          ) : null}
          {data.status === 'APPROVED' ? (
            <Button onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
              {t('send')}
            </Button>
          ) : null}
          {canReject ? (
            <Button
              variant="ghost"
              onClick={() => rejectMutation.mutate()}
              loading={rejectMutation.isPending}
            >
              {t('reject')}
            </Button>
          ) : null}
          {['APPROVED', 'SENT', 'REJECTED', 'REVISION_REQUESTED', 'VIEWED'].includes(data.status) ? (
            <Button
              variant="secondary"
              onClick={() => reviseMutation.mutate()}
              loading={reviseMutation.isPending}
            >
              {tc('revise')}
            </Button>
          ) : null}
        </div>
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card title={t('lines')} padded={false}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tc('description')}</TableHeaderCell>
              <TableHeaderCell>{tc('qty')}</TableHeaderCell>
              <TableHeaderCell>{tc('dims')}</TableHeaderCell>
              <TableHeaderCell>{tc('specs')}</TableHeaderCell>
              <TableHeaderCell>{tc('price')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data.lines ?? []).map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableNumericCell>{String(line.quantity)}</TableNumericCell>
                <TableNumericCell>
                  {[line.width, line.height, line.depth].filter((v) => v != null).join('×') || '—'}
                </TableNumericCell>
                <TableCell>
                  {[line.material, line.fabric, line.color].filter(Boolean).join(' / ') || '—'}
                </TableCell>
                <TableNumericCell>{Number(line.unitPrice).toFixed(2)}</TableNumericCell>
                <TableNumericCell>{Number(line.lineTotal).toFixed(2)}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      </MotionSection>
      </div>
    </div>
  );
}
