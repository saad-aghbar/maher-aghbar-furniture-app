'use client';

import { OrderLineSetupPanel } from '@/components/sales-orders/order-line-setup-panel';
import { PlanLineOutputs } from '@/components/sales-orders/plan-line-outputs';
import { PlanLineSchedule } from '@/components/sales-orders/plan-line-schedule';
import { PlanStagesBoard } from '@/components/sales-orders/plan-stages-board';
import { OrderFabricTracker } from '@/components/purchasing/order-fabric-tracker';
import { useOrdersCopy } from '@/components/orders/orders-shared';
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
  ActionDock,
  Board,
  BoardSkeleton,
  Button,
  ConfirmDialog,
  DetailHero,
  ErrorBoard,
  InkPill,
  ListRow,
  ListRows,
  Ltr,
  Meter,
  RowThumb,
  Stamp,
  Ticket,
  useToast,
  type BoardTone,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type WorkflowRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  status: string;
  scope?: 'STANDARD' | 'RETURN' | string | null;
  activeVersionId?: string | null;
  activeVersion?: { id: string } | null;
};

type Props = { salesOrderId: string; initialLineId?: string | null };

function readinessTone(status: string): BoardTone {
  const s = status.toUpperCase();
  if (s === 'READY' || s === 'AVAILABLE') return 'success';
  if (s === 'SHORTAGE' || s === 'NEEDS_SELECTION' || s === 'NEEDS_REVIEW') return 'warning';
  return 'neutral';
}

export function OrderProductionSetupView({ salesOrderId, initialLineId }: Props) {
  const copy = useOrdersCopy();
  const t = useTranslations('sales');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const toast = useToast();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [preview, setPreview] = useState<OrderSetupReleasePreview | null>(null);

  useEffect(() => {
    if (initialLineId) setExpandedLineId(initialLineId);
  }, [initialLineId]);

  const setupQuery = useQuery({ queryKey: ['order-production-setup', salesOrderId], queryFn: () => fetchOrderProductionSetup(salesOrderId) });
  const orderQuery = useQuery({
    queryKey: ['sales-order', salesOrderId],
    queryFn: () =>
      apiFetch<{ productionOrders?: Array<{ id: string; salesOrderLineId?: string | null; releasedToFactoryAt?: string | null }> }>(
        `/api/v1/sales-orders/${salesOrderId}`,
      ),
  });
  const workflowsQuery = useQuery({
    queryKey: ['production-workflows'],
    queryFn: async () => {
      const rows = await apiFetch<WorkflowRow[]>('/api/v1/production-workflows');
      // Return-scoped workflows (repair / dismantle) never apply to a new order.
      return rows.filter((w) => (w.scope ?? 'STANDARD') !== 'RETURN').map((w) => ({ ...w, activeVersionId: w.activeVersionId ?? w.activeVersion?.id ?? null }));
    },
  });

  const invalidate = async () => {
    await Promise.all(['order-production-setup', 'sales-order', 'sales-orders', 'production-orders', 'orders-desk', 'section-counts'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  };

  const markReadyMutation = useMutation({
    mutationFn: () => markOrderSetupReady(salesOrderId),
    onSuccess: async () => {
      setError(null);
      toast.success(t('orderSetup.markedReady'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const releaseMutation = useMutation({
    mutationFn: () => releaseOrderProductionSetup(salesOrderId),
    onSuccess: async (result) => {
      setError(null);
      setReleaseOpen(false);
      toast.success(result.workerAssignmentRequired ? t('orderSetup.releasedWorkerRequired') : t('orderSetup.released'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const ensureMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/sales-orders/${salesOrderId}/production-setup/ensure`, { method: 'POST' }),
    onSuccess: () => void invalidate(),
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const openRelease = async () => {
    setError(null);
    try {
      setPreview(await fetchOrderSetupReleasePreview(salesOrderId));
      setReleaseOpen(true);
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  };

  const setup = setupQuery.data;
  const readOnly = setup?.status === 'RELEASED';
  const customerName = setup?.salesOrder.customer ? localizedName(copy.locale, setup.salesOrder.customer, setup.salesOrder.customer.nameEn ?? '') : undefined;

  if (setupQuery.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} header={false} className="h-52" />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (setupQuery.isError || !setup) return <ErrorBoard title={tNav('productionPlan')} onRetry={() => setupQuery.refetch()} />;
  if (setup.initialized === false) {
    return (
      <Board tone="neutral">
        <Board.Header title={tNav('productionPlan')} description={<Ltr>{setup.salesOrder.number}</Ltr>} />
        <Board.Empty title={t('orderSetup.noLines')} description={t('orderSetup.planStagesHint')} />
        <Board.Footer>
          <Button size="sm" loading={ensureMutation.isPending} onClick={() => ensureMutation.mutate()}>
            {t('prepareProduction')}
          </Button>
          {error ? <p className="m-0 text-[13px] text-[var(--maher-error)]">{error}</p> : null}
        </Board.Footer>
      </Board>
    );
  }

  const focusedLine = initialLineId
    ? setup.lines.find((line) => line.id === initialLineId || line.salesOrderLineId === initialLineId) ?? null
    : null;
  const lineOrders = (orderQuery.data?.productionOrders ?? []).filter(
    (po) => !focusedLine || po.salesOrderLineId === focusedLine.salesOrderLineId,
  );
  const factoryReleased = lineOrders.some((po) => Boolean(po.releasedToFactoryAt));
  const statusLabel =
    setup.status === 'RELEASED'
      ? t(factoryReleased ? 'orderSetup.releasedToFactory' : 'orderSetup.setupOrdersCreated')
      : copy.status(setup.status);
  const readiness = setup.materialReadiness;
  const tone: BoardTone = readOnly ? 'success' : setup.validation.ok ? 'brand' : 'warning';
  const canMarkReady = !setup.validation.ok || setup.status === 'READY_FOR_RELEASE' ? false : true;
  const canRelease = setup.validation.ok || setup.status === 'READY_FOR_RELEASE';

  const primary = readOnly ? (
    <Link href="/admin/production" className="maher-press inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--maher-text-primary)] px-4 text-[13px] font-semibold text-[var(--maher-background)] hover:opacity-90">
      {t('orderSetup.openProduction')}
    </Link>
  ) : (
    <InkPill disabled={!canRelease} onClick={() => void openRelease()}>
      {t('orderSetup.release')}
    </InkPill>
  );
  const secondary = !readOnly ? (
    <Button variant="secondary" disabled={!canMarkReady} loading={markReadyMutation.isPending} onClick={() => markReadyMutation.mutate()}>
      {t('orderSetup.markReady')}
    </Button>
  ) : null;

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        LinkComponent={Link}
        back={{
          label: initialLineId ? t('orderSetup.lines') : setup.salesOrder.number,
          href: initialLineId
            ? `/admin/sales-orders/${salesOrderId}/production-plan`
            : `/admin/sales-orders/${salesOrderId}`,
        }}
        code={setup.salesOrder.number}
        title={tNav('productionPlan')}
        subtitle={[customerName, setup.salesOrder.projectName].filter(Boolean).join(' · ') || undefined}
        status={{ label: statusLabel, tone: factoryReleased ? 'success' : tone }}
        facts={[
          { label: t('orderSetup.progress'), value: `${setup.progress.readyLines}/${setup.progress.totalLines}`, ltr: true },
          { label: t('orderSetup.readiness'), value: copy.status(readiness.status), tone: readinessTone(readiness.status) },
          { label: t('orderSetup.issuesTitle'), value: String(setup.validation.issues.length), ltr: true, tone: setup.validation.issues.length ? 'warning' : 'success' },
          { label: tc('lineItems'), value: String(setup.lines.length), ltr: true },
          ...(setup.status === 'RELEASED'
            ? [{ label: t('orderSetup.factoryFloor'), value: factoryReleased ? t('orderSetup.releasedToFactory') : t('orderSetup.notReleasedToFactory'), tone: (factoryReleased ? 'success' : 'neutral') as BoardTone }]
            : []),
        ]}
        primary={primary}
        actions={secondary}
      >
        <div className="space-y-4">
          <Meter value={setup.progress.percent} max={100} tone={readOnly ? 'success' : 'brand'} label={t('orderSetup.progressSummary', { ready: String(setup.progress.readyLines), total: String(setup.progress.totalLines), percent: String(setup.progress.percent) })} valueLabel={`${setup.progress.percent}%`} />
        </div>
      </DetailHero>

      {!setup.validation.ok || readiness.anyShortage ? (
        <Board tone="warning" wash="top">
          <Board.Header title={t('orderSetup.issuesTitle')} description={readiness.anyShortage ? t('orderSetup.shortageNote') : undefined} meta={<Stamp tone="warning" size="sm">{setup.validation.issues.length}</Stamp>} />
          <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
            {setup.validation.issues.slice(0, 8).map((issue) => {
              const line = issue.lineId ? setup.lines.find((l) => l.id === issue.lineId || l.salesOrderLineId === issue.lineId) : null;
              return (
                <li key={`${issue.code}-${issue.lineId ?? ''}-${issue.message}`}>
                  <Ticket tone="warning" title={issue.message} why={line ? line.manufacturingName ?? line.description ?? undefined : issue.section ?? undefined} onClick={line ? () => setExpandedLineId(line.id) : undefined} action={line ? tCommon('details') : undefined} />
                </li>
              );
            })}
          </ul>
        </Board>
      ) : initialLineId ? null : (
        <Board tone="success">
          <Board.Header title={t('orderSetup.validationOk')} description={t('orderSetup.reviewReleaseHint')} />
        </Board>
      )}

      {initialLineId ? null : (
      <Board tone="brand">
        <Board.Header title={t('orderSetup.lines')} description={t('orderSetup.reviewReleaseHint')} meta={<span className="tabular-nums">{setup.lines.length}</span>} />
        {setup.lines.length === 0 ? (
          <Board.Empty title={t('orderSetup.noLines')} />
        ) : (
          <ListRows>
            {setup.lines.map((line) => {
              const complexity = line.manufacturingComplexity ?? 'STANDARD';
              const kind = complexity === 'CUSTOM' ? tc('lineKindCustom') : complexity === 'MODIFIED' ? tc('lineKindCustomized') : tc('lineKindStandard');
              const done = line.status === 'READY' || line.status === 'RELEASED';
              return (
                <ListRow
                  key={line.id}
                  href={`/admin/sales-orders/${salesOrderId}/production-plan?lineId=${encodeURIComponent(line.salesOrderLineId ?? line.id)}`}
                  LinkComponent={Link}
                  selected={focusedLine?.id === line.id}
                  leading={<RowThumb src={line.product?.imageUrl} className="h-11 w-11" icon={<Stamp tone={complexity === 'CUSTOM' ? 'warning' : complexity === 'MODIFIED' ? 'info' : 'neutral'} />} />}
                  title={
                    <span className="flex items-center gap-2">
                      {line.itemNumber ? <Ltr className="text-[12px] font-medium text-[var(--maher-text-tertiary)]">{line.itemNumber}</Ltr> : null}
                      {line.manufacturingName ?? line.description ?? line.product?.nameEn ?? '—'}
                    </span>
                  }
                  meta={`${kind} · × ${line.quantity}${line.materialStatus ? ` · ${copy.status(line.materialStatus)}` : ''}`}
                  trailing={
                    <Stamp tone={done ? 'success' : line.status === 'NEEDS_REVIEW' ? 'warning' : 'neutral'} size="sm">
                      {copy.status(line.status)}
                    </Stamp>
                  }
                />
              );
            })}
          </ListRows>
        )}
      </Board>
      )}

      {initialLineId ? (
        focusedLine ? (
          <OrderLineSetupPanel
            salesOrderId={salesOrderId}
            line={focusedLine}
            workflows={workflowsQuery.data ?? []}
            readOnly={readOnly}
            expanded
            onToggle={() => undefined}
            onUpdated={() => void invalidate()}
          />
        ) : (
          <ErrorBoard title={tNav('productionPlan')} description={t('orderSetup.lineMissing')} />
        )
      ) : null}

      {focusedLine ? (
        <>
          <PlanLineSchedule salesOrderId={salesOrderId} salesOrderLineId={focusedLine.salesOrderLineId} />
          {lineOrders[0] ? <PlanLineOutputs productionOrderId={lineOrders[0].id} /> : null}
          <OrderFabricTracker salesOrderId={salesOrderId} />
          <PlanStagesBoard salesOrderId={salesOrderId} lines={[focusedLine]} released={readOnly} />
        </>
      ) : null}

      <ActionDock className="md:hidden" note={<Ltr>{`${setup.progress.percent}%`}</Ltr>}>
        {secondary}
        {primary}
      </ActionDock>

      <ConfirmDialog
        open={releaseOpen}
        title={t('orderSetup.releaseConfirmTitle')}
        description={preview ? [t('orderSetup.releaseConfirmDescription'), preview.materialReadiness.anyShortage ? t('orderSetup.releaseShortageWarning') : null].filter(Boolean).join(' ') : t('orderSetup.releaseConfirmDescription')}
        confirmLabel={t('orderSetup.release')}
        cancelLabel={tCommon('cancel')}
        loading={releaseMutation.isPending}
        error={error}
        onConfirm={() => releaseMutation.mutate()}
        onClose={() => setReleaseOpen(false)}
      >
        {preview?.lines.length ? (
          <ul className="mt-3 m-0 list-none divide-y divide-[var(--maher-border)] rounded-[12px] border border-[var(--maher-border)] p-0">
            {preview.lines.map((l) => (
              <li key={l.salesOrderLineId} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="min-w-0 truncate">{l.manufacturingName ?? '—'}</span>
                <span className="flex items-center gap-2">
                  {l.materialStatus ? <Stamp tone={readinessTone(l.materialStatus)} size="sm">{copy.status(l.materialStatus)}</Stamp> : null}
                  <Ltr className="text-[var(--maher-text-secondary)]">× {l.quantity}</Ltr>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
