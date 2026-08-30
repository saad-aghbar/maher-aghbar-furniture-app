'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { OrderLineSetupPanel } from '@/components/sales-orders/order-line-setup-panel';
import { Link } from '@/i18n/navigation';
import {
  apiFetch,
  fetchOrderProductionSetup,
  fetchOrderSetupReleasePreview,
  markOrderSetupReady,
  releaseOrderProductionSetup,
  type OrderProductionSetup,
  type OrderSetupReleasePreview,
} from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Skeleton,
  StatusBadge,
  MotionSection,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type WorkflowRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  status: string;
  activeVersionId?: string | null;
  activeVersion?: { id: string } | null;
};

const STEP_KEYS = ['setup', 'lines', 'ready', 'released'] as const;

type Props = {
  salesOrderId: string;
};

export function OrderProductionSetupView({ salesOrderId }: Props) {
  const locale = useLocale();
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [preview, setPreview] = useState<OrderSetupReleasePreview | null>(null);

  const setupQuery = useQuery({
    queryKey: ['order-production-setup', salesOrderId],
    queryFn: () => fetchOrderProductionSetup(salesOrderId),
  });

  const workflowsQuery = useQuery({
    queryKey: ['production-workflows'],
    queryFn: async () => {
      const rows = await apiFetch<WorkflowRow[]>('/api/v1/production-workflows');
      return rows.map((w) => ({
        ...w,
        activeVersionId: w.activeVersionId ?? w.activeVersion?.id ?? null,
      }));
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['order-production-setup', salesOrderId] });
    await qc.invalidateQueries({ queryKey: ['sales-order', salesOrderId] });
    await qc.invalidateQueries({ queryKey: ['sales-orders'] });
    await qc.invalidateQueries({ queryKey: ['production-orders'] });
    await qc.invalidateQueries({ queryKey: ['orders-hub-sales-orders'] });
  };

  const markReadyMutation = useMutation({
    mutationFn: () => markOrderSetupReady(salesOrderId),
    onSuccess: async () => {
      setError(null);
      setBanner(t('orderSetup.markedReady'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const releaseMutation = useMutation({
    mutationFn: () => releaseOrderProductionSetup(salesOrderId),
    onSuccess: async (result) => {
      setError(null);
      setReleaseOpen(false);
      setBanner(
        result.workerAssignmentRequired
          ? t('orderSetup.releasedWorkerRequired')
          : t('orderSetup.released'),
      );
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const openRelease = async () => {
    setError(null);
    try {
      const data = await fetchOrderSetupReleasePreview(salesOrderId);
      setPreview(data);
      setReleaseOpen(true);
    } catch (err) {
      setError(mutationErrorMessage(err));
    }
  };

  const setup = setupQuery.data;
  const readOnly = setup?.status === 'RELEASED';
  const customerName = setup?.salesOrder.customer
    ? localizedName(locale, setup.salesOrder.customer, setup.salesOrder.customer.nameEn ?? '')
    : undefined;

  const stepDone = useMemo(() => {
    const map = new Map((setup?.progress.steps ?? []).map((s) => [s.key, s.done]));
    return STEP_KEYS.map((key) => ({ key, done: Boolean(map.get(key)) }));
  }, [setup?.progress.steps]);

  if (setupQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (setupQuery.isError || !setup) {
    return (
      <ErrorState
        title={t('orderSetup.title')}
        onRetry={() => setupQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/sales-orders/${salesOrderId}`}
        title={t('orderSetup.title')}
        description={`${setup.salesOrder.number}${customerName ? ` · ${customerName}` : ''}`}
        actions={
          <div className="maher-detail-sticky-actions flex flex-wrap items-center gap-2">
            <StatusBadge status={setup.status} />
            <Link href={`/sales-orders/${salesOrderId}`}>
              <Button variant="ghost" size="sm">
                {t('detail')}
              </Button>
            </Link>
          </div>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {readOnly ? (
        <Alert variant="info">
          <p className="font-medium">{t('orderSetup.workerAssignmentRequired')}</p>
          <p className="mt-1 text-sm text-text-secondary">
            {t('orderSetup.workerAssignmentHint')}
          </p>
          <div className="mt-3">
            <Link href="/production">
              <Button size="sm" variant="secondary">
                {t('orderSetup.openProduction')}
              </Button>
            </Link>
          </div>
        </Alert>
      ) : null}

      <MotionSection className="maher-form-section" as="div">
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{t('orderSetup.progress')}</h2>
              <p className="text-sm text-text-secondary">
                {t('orderSetup.progressSummary', {
                  ready: String(setup.progress.readyLines),
                  total: String(setup.progress.totalLines),
                  percent: String(setup.progress.percent),
                })}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums" dir="ltr">
              {setup.progress.percent}%
            </p>
          </div>
          <ol className="grid gap-2 sm:grid-cols-4">
            {stepDone.map((step, index) => (
              <li
                key={step.key}
                className={`rounded-xl border p-3 text-sm ${
                  step.done
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-[var(--maher-surface-muted)]/30'
                }`}
              >
                <p className="text-[11px] text-text-tertiary">
                  {t('orderSetup.stepN', { n: String(index + 1) })}
                </p>
                <p className="font-medium">{t(`orderSetup.steps.${step.key}`)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">{t('orderSetup.readiness')}</h2>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={setup.materialReadiness.status} />
            {setup.materialReadiness.anyShortage ? (
              <p className="text-sm text-text-secondary">{t('orderSetup.shortageNote')}</p>
            ) : null}
          </div>
          {!setup.validation.ok ? (
            <Alert variant="warning">
              <p className="mb-1 font-medium">{t('orderSetup.issuesTitle')}</p>
              <ul className="list-disc space-y-1 ps-4 text-sm">
                {setup.validation.issues.slice(0, 8).map((issue) => (
                  <li key={`${issue.code}-${issue.lineId ?? ''}-${issue.message}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            <p className="text-sm text-text-secondary">{t('orderSetup.validationOk')}</p>
          )}
        </Card>
      </MotionSection>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">{t('orderSetup.lines')}</h2>
        {setup.lines.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-text-secondary">{t('orderSetup.noLines')}</p>
          </Card>
        ) : (
          setup.lines.map((line) => (
            <OrderLineSetupPanel
              key={line.id}
              salesOrderId={salesOrderId}
              line={line}
              workflows={workflowsQuery.data ?? []}
              readOnly={readOnly}
              expanded={expandedLineId === line.id}
              onToggle={() =>
                setExpandedLineId((prev) => (prev === line.id ? null : line.id))
              }
              onUpdated={() => {
                void invalidate();
              }}
            />
          ))
        )}
      </div>

      {!readOnly ? (
        <MotionSection className="maher-form-section" as="div">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="text-base font-semibold">{t('orderSetup.reviewRelease')}</h2>
              <p className="text-sm text-text-secondary">{t('orderSetup.reviewReleaseHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!setup.validation.ok || setup.status === 'READY_FOR_RELEASE'}
                loading={markReadyMutation.isPending}
                onClick={() => markReadyMutation.mutate()}
              >
                {t('orderSetup.markReady')}
              </Button>
              <Button
                disabled={!setup.validation.ok && setup.status !== 'READY_FOR_RELEASE'}
                onClick={() => void openRelease()}
              >
                {t('orderSetup.release')}
              </Button>
            </div>
          </Card>
        </MotionSection>
      ) : (
        <ReleasedSpecSummary setup={setup} />
      )}

      <ConfirmDialog
        open={releaseOpen}
        title={t('orderSetup.releaseConfirmTitle')}
        description={
          preview
            ? [
                t('orderSetup.releaseConfirmDescription'),
                preview.materialReadiness.anyShortage
                  ? t('orderSetup.releaseShortageWarning')
                  : null,
                preview.note ?? null,
              ]
                .filter(Boolean)
                .join(' ')
            : t('orderSetup.releaseConfirmDescription')
        }
        confirmLabel={t('orderSetup.release')}
        loading={releaseMutation.isPending}
        error={error}
        onConfirm={() => releaseMutation.mutate()}
        onClose={() => setReleaseOpen(false)}
      />
    </div>
  );
}

function ReleasedSpecSummary({ setup }: { setup: OrderProductionSetup }) {
  const locale = useLocale();
  const t = useTranslations('sales');

  return (
    <MotionSection className="maher-form-section" as="div">
      <Card className="space-y-4 p-4">
        <div>
          <h2 className="text-base font-semibold">{t('orderSetup.releasedSpec')}</h2>
          <p className="text-sm text-text-secondary">{t('orderSetup.releasedSpecHint')}</p>
        </div>
        <ul className="space-y-3">
          {setup.lines.map((line) => (
            <li
              key={line.id}
              className="rounded-xl border border-border bg-[var(--maher-surface-muted)]/40 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{line.manufacturingName ?? '—'}</p>
                <span className="text-sm tabular-nums text-text-secondary" dir="ltr">
                  × {line.quantity}
                </span>
              </div>
              {line.workflow ? (
                <p className="mt-1 text-sm text-text-secondary">
                  {localizedName(locale, line.workflow, line.workflow.code)}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-text-tertiary" dir="ltr">
                {[
                  line.orderDimensions?.width,
                  line.orderDimensions?.height,
                  line.orderDimensions?.depth,
                ]
                  .map((v) => (v != null ? String(v) : null))
                  .filter(Boolean)
                  .join(' × ') || '—'}
              </p>
              <p className="mt-2 text-xs text-text-tertiary">
                {t('orderSetup.materialCount', { count: String(line.materials.length) })}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </MotionSection>
  );
}
