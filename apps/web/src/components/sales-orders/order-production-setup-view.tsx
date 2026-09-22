'use client';

import { OrderLineSetupPanel } from '@/components/sales-orders/order-line-setup-panel';
import { PlanStagesBoard } from '@/components/sales-orders/plan-stages-board';
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
  StageStrip,
  Stamp,
  Ticket,
  useToast,
  type BoardTone,
  type StageStripStage,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

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
  const workflowsQuery = useQuery({
    queryKey: ['production-workflows'],
    queryFn: async () => {
      const rows = await apiFetch<WorkflowRow[]>('/api/v1/production-workflows');
      return rows.map((w) => ({ ...w, activeVersionId: w.activeVersionId ?? w.activeVersion?.id ?? null }));
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

  const steps = useMemo<StageStripStage[]>(() => {
    const map = new Map((setup?.progress.steps ?? []).map((s) => [s.key, s.done]));
    let currentSet = false;
    return STEP_KEYS.map((key) => {
      const done = Boolean(map.get(key));
      let state: StageStripStage['state'] = 'done';
      if (!done && !currentSet) {
        state = 'current';
        currentSet = true;
      } else if (!done) state = 'todo';
      return { key, label: t(`orderSetup.steps.${key}`), state };
    });
  }, [setup?.progress.steps, t]);

  if (setupQuery.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} header={false} className="h-52" />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (setupQuery.isError || !setup) return <ErrorBoard title={tNav('productionPlan')} onRetry={() => setupQuery.refetch()} />;

  const resolvedExpanded = setup.lines.find((line) => line.id === expandedLineId || line.salesOrderLineId === expandedLineId)?.id ?? expandedLineId;
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
        back={{ label: setup.salesOrder.number, href: `/admin/sales-orders/${salesOrderId}` }}
        code={setup.salesOrder.number}
        title={tNav('productionPlan')}
        subtitle={[customerName, setup.salesOrder.projectName].filter(Boolean).join(' · ') || undefined}
        status={{ label: copy.status(setup.status), tone }}
        facts={[
          { label: t('orderSetup.progress'), value: `${setup.progress.readyLines}/${setup.progress.totalLines}`, ltr: true },
          { label: t('orderSetup.readiness'), value: copy.status(readiness.status), tone: readinessTone(readiness.status) },
          { label: t('orderSetup.issuesTitle'), value: String(setup.validation.issues.length), ltr: true, tone: setup.validation.issues.length ? 'warning' : 'success' },
          { label: tc('lineItems'), value: String(setup.lines.length), ltr: true },
        ]}
        primary={primary}
        actions={secondary}
      >
        <div className="space-y-4">
          <Meter value={setup.progress.percent} max={100} tone={readOnly ? 'success' : 'brand'} label={t('orderSetup.progressSummary', { ready: String(setup.progress.readyLines), total: String(setup.progress.totalLines), percent: String(setup.progress.percent) })} valueLabel={`${setup.progress.percent}%`} />
          <StageStrip stages={steps} />
        </div>
      </DetailHero>

      <Board tone="neutral" wash="top">
        <Board.Body>
          <p className="m-0 text-[13px] leading-5 text-[var(--maher-text-secondary)]">
            <span className="font-semibold text-[var(--maher-text-primary)]">{t('orderSetup.prepareSurface')}</span>
            {' · '}
            <span className="font-semibold text-[var(--maher-text-primary)]">{t('orderSetup.factorySurface')}</span>
            {' — '}
            {t('orderSetup.surfaceHint')}
          </p>
        </Board.Body>
      </Board>

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
      ) : (
        <Board tone="success">
          <Board.Header title={t('orderSetup.validationOk')} description={t('orderSetup.reviewReleaseHint')} />
        </Board>
      )}

      <Board tone="brand">
        <Board.Header title={t('orderSetup.lines')} description={t('orderSetup.reviewReleaseHint')} meta={<span className="tabular-nums">{setup.lines.length}</span>} />
        {setup.lines.length === 0 ? (
          <Board.Empty title={t('orderSetup.noLines')} />
        ) : (
          <ListRows>
            {setup.lines.map((line) => {
              const complexity = line.manufacturingComplexity ?? 'STANDARD';
              const kind = complexity === 'CUSTOM' ? tc('lineKindCustom') : complexity === 'MODIFIED' ? tc('lineKindCustomized') : tc('lineKindStandard');
              const selected = resolvedExpanded === line.id;
              const done = line.status === 'READY' || line.status === 'RELEASED';
              return (
                <ListRow
                  key={line.id}
                  selected={selected}
                  onClick={() => setExpandedLineId(line.id === resolvedExpanded ? null : line.id)}
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

      {setup.lines.map((line) => (
        <OrderLineSetupPanel
          key={line.id}
          salesOrderId={salesOrderId}
          line={line}
          workflows={workflowsQuery.data ?? []}
          readOnly={readOnly}
          expanded={resolvedExpanded === line.id}
          onToggle={() => setExpandedLineId((prev) => (prev === line.id ? null : line.id))}
          onUpdated={() => void invalidate()}
        />
      ))}

      <PlanStagesBoard salesOrderId={salesOrderId} lines={setup.lines} released={readOnly} />

      {readOnly ? <ReleasedSpecSummary setup={setup} /> : null}

      <ActionDock className="md:hidden" note={<Ltr>{`${setup.progress.percent}%`}</Ltr>}>
        {secondary}
        {primary}
      </ActionDock>

      <ConfirmDialog
        open={releaseOpen}
        title={t('orderSetup.releaseConfirmTitle')}
        description={preview ? [t('orderSetup.releaseConfirmDescription'), preview.materialReadiness.anyShortage ? t('orderSetup.releaseShortageWarning') : null, preview.note ?? null].filter(Boolean).join(' ') : t('orderSetup.releaseConfirmDescription')}
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

function ReleasedSpecSummary({ setup }: { setup: OrderProductionSetup }) {
  const copy = useOrdersCopy();
  const t = useTranslations('sales');
  return (
    <Board tone="success">
      <Board.Header title={t('orderSetup.releasedSpec')} description={t('orderSetup.releasedSpecHint')} />
      <ListRows>
        {setup.lines.map((line) => {
          const dims = [line.orderDimensions?.width, line.orderDimensions?.height, line.orderDimensions?.depth].map((v) => (v != null ? String(v) : null)).filter(Boolean).join(' × ');
          return (
            <ListRow
              key={line.id}
              tone="success"
              title={line.manufacturingName ?? '—'}
              meta={[line.workflow ? localizedName(copy.locale, line.workflow, line.workflow.code) : null, dims ? `${dims} cm` : null].filter(Boolean).join(' · ')}
              chevron={false}
              trailing={
                <span className="flex flex-col items-end text-[12px] text-[var(--maher-text-secondary)]">
                  <Ltr>× {line.quantity}</Ltr>
                  <span>{t('orderSetup.materialCount', { count: String(line.materials.length) })}</span>
                </span>
              }
            />
          );
        })}
      </ListRows>
    </Board>
  );
}
