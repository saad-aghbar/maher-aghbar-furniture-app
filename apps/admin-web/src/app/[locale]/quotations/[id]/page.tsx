'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Card, Skeleton, ErrorState, StatusBadge, Button, Alert } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface QuotationDetail {
  id: string;
  number: string;
  customerName: string;
  total: number;
  status: string;
  canApprove?: boolean;
  canSend?: boolean;
}

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('quotations');
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
      setMessage('Revision created');
      router.push(`/quotations/${revised.id}`);
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) {
    return (
      <ErrorState title={t('detail')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/quotations">
          <Button variant="ghost" size="sm">
            {tCommon('back')}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{data.number}</h1>
        <StatusBadge status={data.status} />
      </div>
      {message ? <Alert variant="success">{message}</Alert> : null}
      <Card title={t('detail')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('customer')}</dt>
            <dd className="font-medium">{data.customerName}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('total')}</dt>
            <dd className="font-medium">
              {data.total.toLocaleString('ar-JO')} {tCommon('currency')}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          {data.status === 'INTERNAL_REVIEW' ? (
            <Button onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
              {t('approve')}
            </Button>
          ) : null}
          {data.status === 'APPROVED' ? (
            <Button onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
              {t('send')}
            </Button>
          ) : null}
          {['APPROVED', 'SENT', 'REJECTED', 'REVISION_REQUESTED', 'VIEWED'].includes(data.status) ? (
            <Button
              variant="secondary"
              onClick={() => reviseMutation.mutate()}
              loading={reviseMutation.isPending}
            >
              Revise
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
