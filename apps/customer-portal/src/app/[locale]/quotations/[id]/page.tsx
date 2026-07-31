'use client';

import { apiFetch } from '@/lib/api-client';
import { Alert, Button, Card, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('quotations');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', params.id],
    queryFn: () => apiFetch<{ id: string; number: string; status: string; total: string; lines: unknown[] }>(
      `/api/v1/quotations/${params.id}`,
    ),
  });

  async function act(path: string) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/quotations/${params.id}/${path}`, { method: 'POST', body: '{}' });
      await qc.invalidateQueries({ queryKey: ['quotation', params.id] });
    } catch {
      setError('Action failed');
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {data.number}
          </h1>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-lg font-semibold">
          {t('total')}: {String(data.total)} {tCommon('currency')}
        </p>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Card title={t('detail')}>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => act('accept')} loading={loading}>
            {t('accept')}
          </Button>
          <Button variant="danger" onClick={() => act('reject')} loading={loading}>
            {t('reject')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
