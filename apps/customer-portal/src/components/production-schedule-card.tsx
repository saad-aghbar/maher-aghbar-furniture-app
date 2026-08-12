'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Alert, Button, Card, Ltr, Modal, Skeleton, StatusBadge, TextArea } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface OwnOrderSchedule {
  productionOrderId: string;
  number: string;
  promiseState: string;
  requestedDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
  committedDeliveryDate: string | null;
  canUpdateDeliveryDate: boolean;
  canRequestDateChange: boolean;
  dateChangeLocked: boolean;
  dateChangeReason: string;
}

function toDateOnly(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 10);
}

/**
 * Dealer-safe production schedule summary for a single production order.
 * Never shows assigned workers, departments, or capacity — only the
 * commercial promise state and requested/suggested/committed dates.
 */
export function ProductionScheduleCard({ productionOrderId }: { productionOrderId: string }) {
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['own-order-schedule', productionOrderId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => apiFetch<OwnOrderSchedule>(`/api/v1/scheduling/orders/${productionOrderId}`),
  });

  const changeDateMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; action: 'updated' | 'requested' }>(
        `/api/v1/scheduling/orders/${productionOrderId}/dealer-date`,
        {
          method: 'POST',
          body: JSON.stringify({
            requestedDeliveryDate: newDate,
            reason: reason.trim() || undefined,
          }),
        },
      ),
    onSuccess: async (res) => {
      setModalOpen(false);
      setError(null);
      setBanner(
        res.action === 'updated' ? tp('dealerDateUpdated') : tp('dealerDateChangeRequested'),
      );
      setReason('');
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      setError(mutationErrorMessage(err, tCommon('actionFailed')));
    },
  });

  function openModal() {
    setNewDate(toDateOnly(data?.requestedDeliveryDate) ?? '');
    setReason('');
    setError(null);
    setModalOpen(true);
  }

  if (isLoading) {
    return (
      <Card title={tp('schedulingSection')} className="maher-form-section">
        <Skeleton className="h-24 w-full rounded-xl" />
      </Card>
    );
  }

  if (isError || !data) {
    return null;
  }

  return (
    <Card
      title={tp('schedulingSection')}
      description={tp('schedulingSectionHint')}
      className="maher-form-section"
    >
      <div className="space-y-4">
        {banner ? <Alert variant="success">{banner}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.promiseState} />
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-tertiary">{tp('requestedDate')}</dt>
            <dd className="mt-0.5 text-sm font-medium" dir="ltr">
              {toDateOnly(data.requestedDeliveryDate) ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{tp('suggestedDate')}</dt>
            <dd className="mt-0.5 text-sm font-medium" dir="ltr">
              {toDateOnly(data.suggestedDeliveryDate) ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{tp('committedDate')}</dt>
            <dd className="mt-0.5 text-sm font-medium" dir="ltr">
              {toDateOnly(data.committedDeliveryDate) ?? '—'}
            </dd>
          </div>
        </dl>

        {data.dateChangeLocked ? (
          <Alert variant="info">
            {tp('dateChangeLockedHint')}
            {data.dateChangeReason ? ` — ${data.dateChangeReason}` : ''}
          </Alert>
        ) : (
          <Button variant="secondary" size="sm" onClick={openModal}>
            {data.canRequestDateChange ? tp('requestDateChange') : tp('changeDate')}
          </Button>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={data.canRequestDateChange ? tp('requestDateChange') : tp('changeDate')}
        description={
          data.canRequestDateChange ? tp('requestDateChangeHint') : tp('changeDateHint')
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() => changeDateMutation.mutate()}
              loading={changeDateMutation.isPending}
              disabled={!newDate}
            >
              {tCommon('submit')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="group flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary" htmlFor="new-delivery-date">
              {tp('newPreferredDate')}
            </label>
            <input
              id="new-delivery-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              dir="ltr"
              className="h-10 w-full rounded-[var(--maher-radius-md)] border border-border bg-surface px-3 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <TextArea
            label={tCommon('reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
        </div>
      </Modal>
    </Card>
  );
}
