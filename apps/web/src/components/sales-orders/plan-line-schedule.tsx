'use client';

import { useKitCopy } from '@/lib/kit-copy';
import { useOrdersCopy } from '@/components/orders/orders-shared';
import { apiFetch } from '@/lib/api-client';
import { schedulePlanRequest } from '@/lib/schedule-plan-request';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Board, Button, DateField, Ltr } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type PoRef = {
  id: string;
  number: string;
  salesOrderLineId?: string | null;
  releasedToFactoryAt?: string | null;
  status: string;
};

function ymd(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Line schedule. Reading the production order does not create one. Saving the start is an explicit action. */
export function PlanLineSchedule({
  salesOrderId,
  salesOrderLineId,
}: {
  salesOrderId: string;
  salesOrderLineId: string;
}) {
  const t = useTranslations('production');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const copy = useOrdersCopy();
  const qc = useQueryClient();
  const [start, setStart] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  const order = useQuery({
    queryKey: ['sales-order', salesOrderId],
    queryFn: () => apiFetch<{ productionOrders?: PoRef[] }>(`/api/v1/sales-orders/${salesOrderId}`),
  });
  const match = (order.data?.productionOrders ?? []).find((po) => po.salesOrderLineId === salesOrderLineId) ?? null;
  const detail = useQuery({
    queryKey: ['production-order', match?.id],
    enabled: Boolean(match?.id),
    queryFn: () =>
      apiFetch<{
        id: string;
        number: string;
        plannedStartDate?: string | null;
        plannedCompletionDate?: string | null;
        releasedToFactoryAt?: string | null;
      }>(`/api/v1/production-orders/${match!.id}`),
  });

  useEffect(() => {
    setStart(ymd(detail.data?.plannedStartDate));
  }, [detail.data?.plannedStartDate]);

  const preview = useMutation({
    mutationFn: () => {
      const request = schedulePlanRequest('preview', match!.id, start);
      return apiFetch<unknown>(request.path, { method: request.method });
    },
    onSuccess: () => {
      setError(null);
      setPreviewNote(tSales('orderSetup.schedulePreviewKept'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const apply = useMutation({
    mutationFn: () => {
      const request = schedulePlanRequest('apply', match!.id, start);
      return apiFetch(request.path, { method: request.method, body: JSON.stringify(request.body) });
    },
    onSuccess: async () => {
      setError(null);
      setPreviewNote(null);
      await qc.invalidateQueries({ queryKey: ['production-order', match?.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (order.isLoading || detail.isLoading) {
    return null;
  }
  if (!match) {
    return (
      <Board tone="neutral">
        <Board.Header title={t('plannedStart')} description={tSales('orderSetup.planStagesHint')} />
      </Board>
    );
  }

  const locked = Boolean(detail.data?.releasedToFactoryAt ?? match.releasedToFactoryAt);
  return (
    <Board tone="info">
      <Board.Header
        title={t('plannedStart')}
        description={detail.data?.number ? <Ltr>{detail.data.number}</Ltr> : <Ltr>{match.number}</Ltr>}
      />
      <Board.Body className="space-y-3">
        {locked ? (
          <p className="m-0 text-[14px] text-[var(--maher-text-secondary)]">
            <Ltr>{copy.date(detail.data?.plannedStartDate)}</Ltr>
            {detail.data?.plannedCompletionDate ? (
              <>
                {' · '}
                <Ltr>{copy.date(detail.data.plannedCompletionDate)}</Ltr>
              </>
            ) : null}
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <DateField
              label={t('plannedStart')}
              value={start}
              onChange={setStart}
              copy={kit.date}
              locale={copy.locale}
              todayShortcut
            />
            <Button size="sm" variant="secondary" loading={preview.isPending} onClick={() => preview.mutate()}>
              {tSales('orderSetup.previewSchedule')}
            </Button>
            <Button
              size="sm"
              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(start)}
              loading={apply.isPending}
              onClick={() => apply.mutate()}
            >
              {tCommon('apply')}
            </Button>
          </div>
        )}
        {previewNote ? <p className="m-0 text-[13px] text-[var(--maher-text-secondary)]">{previewNote}</p> : null}
        {error ? <p className="m-0 text-[13px] text-[var(--maher-error)]">{error}</p> : null}
      </Board.Body>
    </Board>
  );
}
