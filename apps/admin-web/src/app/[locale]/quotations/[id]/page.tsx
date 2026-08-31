'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Card, Skeleton, ErrorState, StatusBadge, Button, Alert, Table, TableBody, TableCell,
  TableNumericCell, TableHead, TableHeaderCell, TableRow, MotionSection, Input } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { localizedName, presentQuotationStatus } from '@maher/i18n';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';

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
  manufacturingComplexity?: string | null;
  priceRequired?: boolean;
}

interface QuotationDetail {
  id: string;
  number: string;
  total: number | string;
  status: string;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  offeredDeliveryDate?: string | null;
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
  expirationDate?: string | null;
  commerciallyExpired?: boolean;
  rejectionReason?: string | null;
  version?: number;
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
  const [error, setError] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState('');
  const [offeredDeliveryDate, setOfferedDeliveryDate] = useState('');
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quotation', params.id],
    queryFn: () => apiFetch<QuotationDetail>(`/api/v1/quotations/${params.id}`),
  });

  useEffect(() => {
    if (!data) return;
    setExpirationDate(data.expirationDate ? String(data.expirationDate).slice(0, 10) : '');
    setOfferedDeliveryDate(
      data.offeredDeliveryDate ? String(data.offeredDeliveryDate).slice(0, 10) : '',
    );
    setDraftPrices(
      Object.fromEntries((data.lines ?? []).map((l) => [l.id, String(l.unitPrice ?? '')])),
    );
  }, [data]);

  const draftPayload = () => ({
    expirationDate: expirationDate || undefined,
    offeredDeliveryDate: offeredDeliveryDate || undefined,
    lines: (data?.lines ?? []).map((line) => ({
      description: line.description,
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(draftPrices[line.id] ?? line.unitPrice) || 0,
      material: line.material ?? undefined,
      fabric: line.fabric ?? undefined,
      color: line.color ?? undefined,
      width: line.width != null ? Number(line.width) : undefined,
      height: line.height != null ? Number(line.height) : undefined,
      depth: line.depth != null ? Number(line.depth) : undefined,
      taxRate: line.taxRate != null ? Number(line.taxRate) : undefined,
      manufacturingComplexity: line.manufacturingComplexity ?? undefined,
    })),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (data?.status === 'DRAFT') {
        await apiFetch(`/api/v1/quotations/${params.id}`, {
          method: 'PATCH',
          body: JSON.stringify(draftPayload()),
        });
      }
      return apiFetch(`/api/v1/quotations/${params.id}/send`, { method: 'POST' });
    },
    onSuccess: () => {
      setError(null);
      setMessage(t('sendQuotation'));
      queryClient.invalidateQueries({ queryKey: ['quotation', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/quotations/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draftPayload()),
      }),
    onSuccess: () => {
      setError(null);
      setMessage(tCommon('saved'));
      queryClient.invalidateQueries({ queryKey: ['quotation', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
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

  const canReject = ['INTERNAL_REVIEW', 'APPROVED', 'SENT', 'VIEWED'].includes(data.status);
  const canSend = ['DRAFT', 'INTERNAL_REVIEW', 'APPROVED'].includes(data.status);
  const isDraft = data.status === 'DRAFT';
  const draftTotals = (data.lines ?? []).reduce(
    (acc, line) => {
      const unit = Number(draftPrices[line.id] ?? line.unitPrice);
      const qty = Number(line.quantity) || 0;
      const net = Number.isFinite(unit) && unit > 0 ? unit * qty : 0;
      const rateRaw = line.taxRate == null || line.taxRate === '' ? 0.16 : Number(line.taxRate);
      const rate = Number.isFinite(rateRaw) ? rateRaw : 0.16;
      acc.subtotal += net;
      acc.tax += net * rate;
      acc.total = acc.subtotal + acc.tax;
      return acc;
    },
    { subtotal: 0, tax: 0, total: 0 },
  );
  const displayTotal = isDraft ? draftTotals.total : Number(data.total);
  const statusLabel = presentQuotationStatus(locale, data.status, data.commerciallyExpired);
  const customerLabel = data.customer
    ? localizedName(locale, data.customer, data.customer.name)
    : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/orders"
        title={data.number}
        description={customerLabel}
        actions={
          <StatusBadge
            status={data.commerciallyExpired ? 'EXPIRED' : data.status}
            label={statusLabel}
          />
        }
      />
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {data.commerciallyExpired ? <Alert variant="warning">{t('expiredCannotAccept')}</Alert> : null}
      {data.rejectionReason ? (
        <Alert variant="info">
          {t('rejectionReason')}: {data.rejectionReason}
        </Alert>
      ) : null}
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
              {displayTotal.toLocaleString('en-US', {
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
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('factoryDelivery')}</dt>
            <dd>
              {isDraft ? (
                <Input
                  type="date"
                  value={offeredDeliveryDate}
                  onChange={(e) => setOfferedDeliveryDate(e.target.value)}
                />
              ) : (
                <span className="font-medium" dir="ltr">
                  {offeredDeliveryDate || '—'}
                </span>
              )}
            </dd>
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
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('validUntil')}</dt>
            <dd>
              {isDraft ? (
                <Input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              ) : (
                <span className="font-medium" dir="ltr">
                  {data.expirationDate ? String(data.expirationDate).slice(0, 10) : '—'}
                </span>
              )}
            </dd>
          </div>
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
          {isDraft ? (
            <Button
              variant="secondary"
              onClick={() => saveDraftMutation.mutate()}
              loading={saveDraftMutation.isPending}
            >
              {tCommon('save')}
            </Button>
          ) : null}
          {canSend ? (
            <Button onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
              {t('sendQuotation')}
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
              <TableHeaderCell>{t('complexityLabel')}</TableHeaderCell>
              <TableHeaderCell>{tc('price')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data.lines ?? []).map((line) => {
              const complexity =
                line.manufacturingComplexity === 'MODIFIED' ||
                line.manufacturingComplexity === 'CUSTOM'
                  ? line.manufacturingComplexity
                  : 'STANDARD';
              const unit = Number(draftPrices[line.id] ?? line.unitPrice);
              const qty = Number(line.quantity) || 0;
              const missingPrice = !Number.isFinite(unit) || unit <= 0;
              const lineNet = missingPrice ? null : unit * qty;
              return (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableNumericCell>{String(line.quantity)}</TableNumericCell>
                <TableNumericCell>
                  {[line.width, line.height, line.depth].filter((v) => v != null).join('×') || '—'}
                </TableNumericCell>
                <TableCell>
                  {[line.material, line.fabric, line.color].filter(Boolean).join(' / ') || '—'}
                </TableCell>
                <TableCell>
                  {complexity === 'CUSTOM'
                    ? t('complexity.CUSTOM')
                    : complexity === 'MODIFIED'
                      ? t('complexity.MODIFIED')
                      : t('complexity.STANDARD')}
                </TableCell>
                <TableNumericCell>
                  {isDraft ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draftPrices[line.id] ?? ''}
                      onChange={(e) =>
                        setDraftPrices((prev) => ({ ...prev, [line.id]: e.target.value }))
                      }
                    />
                  ) : missingPrice ? (
                    t('priceRequired')
                  ) : (
                    unit.toFixed(2)
                  )}
                </TableNumericCell>
                <TableNumericCell>
                  {lineNet == null ? '—' : lineNet.toFixed(2)}
                </TableNumericCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      </MotionSection>
      </div>
    </div>
  );
}
