'use client';

import { apiFetch } from '@/lib/api-client';
import { Alert, Button, Card, Skeleton, StatusBadge, TextArea } from '@maher/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('production');
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['task', params.id],
    queryFn: () =>
      apiFetch<{
        id: string;
        number: string;
        name: string;
        description?: string;
        status: string;
        progressPercent: number;
      }>(`/api/v1/tasks/${params.id}`),
  });

  async function act(action: string, body?: object) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/tasks/${params.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
      await qc.invalidateQueries({ queryKey: ['my-tasks'] });
    } catch {
      setError('Action failed');
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{data.name}</h1>
        <p className="text-sm text-[var(--maher-text-secondary)]">{data.number}</p>
        <StatusBadge status={data.status} />
      </div>
      {data.description ? <p className="text-sm">{data.description}</p> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Card title={t('taskDetail')}>
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => act('start')} loading={loading}>
            {t('start')}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => act('pause')} loading={loading}>
            {t('pause')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => act('progress', { percent: Math.min(100, data.progressPercent + 25) })}
            loading={loading}
          >
            +25%
          </Button>
          <Button size="lg" onClick={() => act('complete')} loading={loading}>
            {t('complete')}
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          <TextArea
            label={t('blockedReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <Button
            size="lg"
            variant="danger"
            className="w-full"
            onClick={() => act('block', { category: 'OTHER', reason })}
            loading={loading}
          >
            {t('block')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
