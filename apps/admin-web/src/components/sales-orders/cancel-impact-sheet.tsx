'use client';

import { apiFetch, API_URL } from '@/lib/api-client';
import {
  CANCEL_REASON_CODES,
  type CancelImpactResponse,
  type CancelReasonCode,
} from '@/lib/cancel-impact';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  ErrorState,
  Input,
  Ltr,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
  cn,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Armchair, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  open: boolean;
  salesOrderId: string | null;
  onClose: () => void;
  onCancelled?: (result: {
    financialAttention: boolean;
    salesOrderNumber?: string;
  }) => void;
};

function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url}`;
}

function money(n: number, currency: string) {
  if (!Number.isFinite(n)) return `— ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

export function CancelImpactSheet({ open, salesOrderId, onClose, onCancelled }: Props) {
  const t = useTranslations('sales');
  const tLife = useTranslations('lifecycle');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [reasonCode, setReasonCode] = useState<CancelReasonCode | ''>('');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReasonCode('');
      setNote('');
      setLocalError(null);
    }
  }, [open]);

  const impactQuery = useQuery({
    queryKey: ['sales-order-cancel-impact', salesOrderId],
    queryFn: () =>
      apiFetch<CancelImpactResponse>(`/api/v1/sales-orders/${salesOrderId}/cancel-impact`),
    enabled: open && Boolean(salesOrderId),
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!salesOrderId || !reasonCode) {
        throw new Error('reason required');
      }
      return apiFetch(`/api/v1/sales-orders/${salesOrderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          reasonCode,
          reason: note.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setLocalError(null);
      const impact = impactQuery.data;
      await queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onCancelled?.({
        financialAttention: Boolean(impact?.impact.financialAttention),
        salesOrderNumber: impact?.salesOrder.number,
      });
      onClose();
    },
    onError: (err) => setLocalError(mutationErrorMessage(err)),
  });

  const impact = impactQuery.data;
  const phase = impact?.phase ?? 1;
  const severe = phase === 3 || phase === 4;
  const phase5Blocked = phase === 5 || impact?.canCancel === false;
  const reasonOptions = useMemo(
    () =>
      CANCEL_REASON_CODES.map((code) => ({
        value: code,
        label: t(`cancelReason.${code}` as 'cancelReason.OTHER'),
      })),
    [t],
  );

  const productSrc = mediaSrc(impact?.salesOrder.productImageUrl);
  const canSubmit =
    Boolean(reasonCode) &&
    Boolean(impact?.canCancel) &&
    !phase5Blocked &&
    !cancelMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cancelOrder')}
      description={t('cancelImpact.sheetHint')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={cancelMutation.isPending}>
            {t('cancelImpact.keepOrder')}
          </Button>
          <Button
            variant="danger"
            loading={cancelMutation.isPending}
            disabled={!canSubmit}
            onClick={() => cancelMutation.mutate()}
          >
            {t('cancelOrder')}
          </Button>
        </>
      }
    >
      {impactQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : impactQuery.isError || !impact ? (
        <ErrorState
          title={t('cancelImpact.loadError')}
          onRetry={() => impactQuery.refetch()}
          retryLabel={tCommon('retry')}
        />
      ) : (
        <div className="space-y-5">
          {phase5Blocked ? (
            <Alert variant="warning">
              <p className="font-medium">{t('cancelImpact.useReturnsTitle')}</p>
              <p className="mt-1 text-sm">
                {impact.blockReason === 'USE_RETURN'
                  ? t('cancelImpact.useReturnsBody')
                  : impact.blockReason || t('cancelImpact.useReturnsBody')}
              </p>
            </Alert>
          ) : null}

          {severe && impact.canCancel ? (
            <Alert variant="error">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {t('cancelImpact.severityTitle', { phase })}
                  </p>
                  <p className="mt-1 text-sm">{t('cancelImpact.severityBody')}</p>
                </div>
              </div>
            </Alert>
          ) : null}

          <section
            className={cn(
              'rounded-xl border p-4',
              severe
                ? 'border-[var(--maher-danger)]/30 bg-[color-mix(in_srgb,var(--maher-danger)_6%,var(--maher-surface))]'
                : 'border-border bg-[var(--maher-surface-muted)]/40',
            )}
          >
            <div className="flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]">
                {productSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productSrc}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                    <Armchair className="h-6 w-6 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Ltr className="text-sm font-semibold text-text-primary">
                    {impact.salesOrder.number}
                  </Ltr>
                  <StatusBadge status={impact.salesOrder.status} />
                  <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                    {t('cancelImpact.phaseLabel', { phase })}
                  </span>
                </div>
                <p className="truncate text-sm font-medium text-text-primary">
                  {impact.salesOrder.productSummary || t('cancelImpact.unknownProduct')}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {impact.salesOrder.dealerName || '—'}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {t('cancelImpact.currentState')}
            </h3>
            <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary">
              {impact.currentState}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {t('cancelImpact.impact')}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <ImpactTile
                label={t('cancelImpact.materials')}
                value={money(impact.impact.materialsConsumedAmount, tCommon('currency'))}
                hint={impact.impact.materialsConsumedSummary}
              />
              <ImpactTile
                label={t('cancelImpact.semiLots')}
                value={String(impact.impact.semiLots.length)}
                hint={
                  impact.semiDispositionRequired
                    ? t('cancelImpact.semiDispositionRequired')
                    : undefined
                }
                warn={impact.semiDispositionRequired}
              />
              <ImpactTile
                label={t('cancelImpact.openTasks')}
                value={String(impact.impact.openTasks)}
                hint={t('cancelImpact.tasksHint', {
                  inProgress: impact.impact.inProgressTasks,
                  preserved: impact.impact.completedTasksPreserved,
                })}
              />
              <ImpactTile
                label={t('cancelImpact.purchaseCommitments')}
                value={String(impact.impact.purchaseCommitments.length)}
                hint={t('cancelImpact.purchaseCommitmentsHint')}
              />
            </div>

            {impact.impact.semiLots.length > 0 ? (
              <ul className="space-y-1.5 rounded-lg border border-border bg-surface p-3 text-xs">
                {impact.impact.semiLots.slice(0, 6).map((lot) => (
                  <li key={lot.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <Package className="h-3.5 w-3.5" />
                      <Ltr>{lot.sku}</Ltr>
                    </span>
                    <span className="text-text-tertiary">
                      <Ltr>
                        {lot.qty} · {lot.status}
                      </Ltr>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {impact.impact.finishedLots.length > 0 ? (
              <div className="rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
                <p className="font-medium text-text-primary">
                  {t('cancelImpact.finishedLots', {
                    count: impact.impact.finishedLots.length,
                  })}
                </p>
                {impact.finDispositionRequired ? (
                  <p className="mt-1 text-[var(--maher-warning)]">
                    {t('cancelImpact.finDispositionRequired')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {impact.impact.purchaseCommitments.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-dashed border-border bg-[var(--maher-surface-muted)]/30 p-3 text-xs text-text-secondary">
                {impact.impact.purchaseCommitments.map((po) => (
                  <li key={po.number}>
                    <Ltr className="font-medium text-text-primary">{po.number}</Ltr>
                    {po.sku ? (
                      <>
                        {' · '}
                        <Ltr>{po.sku}</Ltr>
                      </>
                    ) : null}
                    {po.note ? ` — ${po.note}` : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {(impact.impact.invoice ||
              impact.impact.paymentsPresent ||
              impact.impact.financialAttention) && (
              <Alert variant="warning">
                <p className="font-medium">{tLife('financialAttention.title')}</p>
                <p className="mt-1 text-sm">{tLife('financialAttention.body')}</p>
                {impact.impact.invoice ? (
                  <p className="mt-2 text-xs text-text-secondary">
                    {t('cancelImpact.invoiceLine', {
                      number: impact.impact.invoice.number,
                      status: impact.impact.invoice.status,
                      total: money(impact.impact.invoice.total, tCommon('currency')),
                    })}
                  </p>
                ) : null}
              </Alert>
            )}
          </section>

          {!phase5Blocked ? (
            <section className="space-y-3 border-t border-border pt-4">
              <Select
                label={t('cancelImpact.reasonLabel')}
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as CancelReasonCode | '')}
                placeholder={t('cancelImpact.reasonPlaceholder')}
                options={reasonOptions}
                required
              />
              <Input
                label={t('cancelImpact.noteLabel')}
                placeholder={t('cancelImpact.notePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </section>
          ) : null}

          {localError ? <Alert variant="error">{localError}</Alert> : null}
        </div>
      )}
    </Modal>
  );
}

function ImpactTile({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        warn
          ? 'border-[var(--maher-warning)]/35 bg-[color-mix(in_srgb,var(--maher-warning)_8%,var(--maher-surface))]'
          : 'border-border bg-surface',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-text-primary" dir="ltr">
        {value}
      </p>
      {hint ? <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">{hint}</p> : null}
    </div>
  );
}
