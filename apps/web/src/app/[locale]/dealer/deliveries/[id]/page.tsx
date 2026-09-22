'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link, useRouter } from '@/i18n/navigation';
import { ActionDock, Alert, Board, BoardSkeleton, Button, ConfirmDialog, DetailHero, ErrorBoard, KeyFacts, Ledger, LedgerRow, Ltr, StageStrip, Stamp, type BoardTone, type StageStripStage } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type Delivery = {
  id: string;
  number: string;
  status: string;
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
  plannedDate?: string | null;
  notes?: string | null;
  driverName?: string | null;
  salesOrder?: { id: string; number: string; title?: string | null } | null;
  items?: Array<{ id: string; description: string; quantity: string | number }>;
};

const JOURNEY = ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

function tone(status: string): BoardTone {
  switch (status.toUpperCase()) {
    case 'DELIVERED':
      return 'success';
    case 'OUT_FOR_DELIVERY':
    case 'SHIPPED':
      return 'warning';
    case 'CANCELLED':
      return 'error';
    case 'READY':
    case 'PLANNED':
      return 'brand';
    default:
      return 'neutral';
  }
}

export default function DeliveryReceiptPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tl = useTranslations('lifecycle');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({ queryKey: ['customer-delivery', params.id], queryFn: () => apiFetch<Delivery>(`/api/v1/deliveries/${params.id}`) });
  const confirm = useMutation({
    mutationFn: () => apiFetch(`/api/v1/deliveries/${params.id}/confirm-receipt`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-delivery', params.id] });
      await qc.invalidateQueries({ queryKey: ['customer-own-deliveries'] });
      setConfirmOpen(false);
      router.push('/dealer/deliveries');
    },
    onError: (err) => setError(mutationErrorMessage(err) || tCommon('actionFailed')),
  });

  if (query.isLoading && !query.data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorBoard title={t('deliveries')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }
  const row = query.data;
  const status = row.status.toUpperCase();
  const label = (code: string) => {
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const idx = JOURNEY.indexOf(status as (typeof JOURNEY)[number]);
  const eff = idx >= 0 ? idx : status === 'SHIPPED' ? 2 : -1;
  const stages: StageStripStage[] = JOURNEY.map((key, i) => ({ key, label: label(key), state: status === 'CANCELLED' ? 'blocked' : i < eff ? 'done' : i === eff ? 'current' : 'todo' }));
  const canConfirm = status === 'OUT_FOR_DELIVERY' || status === 'SHIPPED';
  const date = row.deliveryDate ?? row.plannedDate;
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        tone={tone(status)}
        back={{ label: t('schedule'), onClick: () => router.push('/dealer/deliveries') }}
        code={row.number}
        title={row.salesOrder?.title || row.salesOrder?.number || row.number}
        subtitle={row.salesOrder ? <Link href={`/dealer/orders/${row.salesOrder.id}`} className="font-medium text-[var(--maher-brand)] hover:underline"><Ltr>{row.salesOrder.number}</Ltr></Link> : undefined}
        status={{ label: label(status), tone: tone(status) }}
        facts={[
          ...(date ? [{ label: status === 'DELIVERED' ? tl('timelineDelivered') : tl('timelineReady'), value: fmt(date), ltr: true }] : []),
          { label: tc('lineItems'), value: `${row.items?.length ?? 0}`, ltr: true },
          ...(row.driverName ? [{ label: tl('viewDelivery'), value: row.driverName }] : []),
        ]}
        primary={canConfirm ? <Button leadingIcon={<PackageCheck className="h-4 w-4" />} onClick={() => setConfirmOpen(true)}>{tl('confirmReceived')}</Button> : undefined}
      >
        <StageStrip stages={stages} compact />
      </DetailHero>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {status === 'DELIVERED' ? <Alert variant="success">{tl('receiptConfirmed')}</Alert> : canConfirm ? <Alert variant="warning">{tl('shippedAwaitingConfirm')}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone="neutral" className="xl:col-span-7">
          <Board.Header title={tc('lineItems')} meta={<Stamp tone="neutral" size="sm">{row.items?.length ?? 0}</Stamp>} />
          {row.items?.length ? (
            <Ledger className="px-5 pb-2">
              {row.items.map((item) => (
                <LedgerRow key={item.id} label={item.description} value={<Ltr>× {String(item.quantity)}</Ltr>} />
              ))}
            </Ledger>
          ) : (
            <Board.Empty title={tCommon('none')} />
          )}
        </Board>
        <Board tone="neutral" className="xl:col-span-5">
          <Board.Header title={tl('viewDelivery')} />
          <KeyFacts
            className="px-5 pb-5"
            columns={2}
            facts={[
              { label: tc('deliveryAddress'), value: row.deliveryAddress || '—', wide: true },
              ...(row.notes ? [{ label: tCommon('notes'), value: row.notes, wide: true }] : []),
              { label: tCommon('status'), value: <Stamp tone={tone(status)} size="sm">{label(status)}</Stamp> },
              ...(date ? [{ label: tCommon('date'), value: fmt(date), ltr: true }] : []),
            ]}
          />
        </Board>
      </div>

      {canConfirm ? (
        <ActionDock className="md:hidden">
          <Button className="flex-1" leadingIcon={<PackageCheck className="h-4 w-4" />} onClick={() => setConfirmOpen(true)}>
            {tl('confirmReceived')}
          </Button>
        </ActionDock>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={tl('confirmReceiptTitle')}
        description={tl('confirmReceiptBody')}
        confirmLabel={tl('confirmReceived')}
        cancelLabel={tCommon('cancel')}
        loading={confirm.isPending}
        error={error}
        onClose={() => !confirm.isPending && setConfirmOpen(false)}
        onConfirm={() => confirm.mutate()}
      />
    </div>
  );
}
