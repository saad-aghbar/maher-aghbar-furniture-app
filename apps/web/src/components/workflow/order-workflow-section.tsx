'use client';

import { ProductionFlowMap, type FlowMapStage } from '@/components/workflow/production-flow-map';
import { apiFetch, API_URL } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, KeyFacts, Meter, Stamp, type BoardTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  withLiveWorkflowGraph,
  workflowGraphHasRunningTimer,
} from '@/lib/live-task-progress';

interface OrderWorkflowStage {
  id: string;
  code: string;
  nodeKey?: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  status: string;
  progressPercent: number;
  isOptional?: boolean;
  isSkipped?: boolean;
  assignedEmployee?: { id: string; name: string } | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualMinutes?: number | null;
  estimatedMinutes?: number | null;
  notes?: string | null;
  blockers?: Array<{ id: string; category: string; reason: string }>;
  elapsedMinutes?: number;
  actualSeconds?: number;
  openStartedAt?: string | null;
  running?: boolean;
  inspectionStatus?: string | null;
  inspectionProgress?: { passed: number; total: number; status?: string | null } | null;
  backForRework?: boolean;
}

interface OrderWorkflowGraph {
  productionOrderId: string;
  progressPercent: number;
  sourceVersionNumber: number | null;
  isLegacy: boolean;
  stages: OrderWorkflowStage[];
  edges: Array<{ from: string; to: string }>;
}

interface ProductionDoc {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
}

function fmtWhen(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function stageTone(status: string): BoardTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'BLOCKED':
    case 'ON_HOLD':
      return 'error';
    case 'IN_PROGRESS':
      return 'info';
    case 'READY_FOR_INSPECTION':
    case 'QUALITY_CHECK':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function OrderWorkflowSection({
  productionOrderId,
  title,
}: {
  productionOrderId: string;
  title?: string;
}) {
  const t = useTranslations('production');
  const tFlow = useTranslations('mobile');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const rtl = locale === 'ar' || locale === 'he';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const graphQuery = useQuery({
    queryKey: ['production-order-workflow', productionOrderId],
    queryFn: () =>
      apiFetch<OrderWorkflowGraph>(`/api/v1/production-orders/${productionOrderId}/workflow`),
  });

  const [now, setNow] = useState(() => Date.now());
  const timerRunning = graphQuery.data
    ? workflowGraphHasRunningTimer(graphQuery.data)
    : false;
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);
  const graph = graphQuery.data
    ? withLiveWorkflowGraph(graphQuery.data, now)
    : graphQuery.data;

  const docsQuery = useQuery({
    queryKey: ['production-order-docs', productionOrderId],
    queryFn: () =>
      apiFetch<{ documents?: ProductionDoc[]; stages?: Array<{ id: string; code: string; tasks?: Array<{ id: string }> }> }>(
        `/api/v1/production-orders/${productionOrderId}`,
      ),
  });

  const selected = graph?.stages.find((s) => s.id === selectedId) ?? graph?.stages[0] ?? null;

  const flowStages: FlowMapStage[] = useMemo(() => {
    if (!graph) return [];
    const deps = new Map<string, string[]>();
    for (const s of graph.stages) deps.set(s.code, []);
    for (const e of graph.edges) {
      const list = deps.get(e.to) ?? [];
      list.push(e.from);
      deps.set(e.to, list);
    }
    return graph.stages.map((s, index) => ({
      id: s.id,
      code: s.code,
      name: localizedName(locale, s, s.code),
      status: s.status,
      progressPercent: s.progressPercent,
      dependsOnCodes: deps.get(s.code) ?? [],
      sortOrder: index,
      estimatedMinutes: s.estimatedMinutes,
    }));
  }, [graph, locale]);

  const photos = useMemo(() => {
    const docs = docsQuery.data?.documents ?? [];
    const stages = docsQuery.data?.stages ?? [];
    const selectedCode = selected?.code;
    const taskIds = new Set(
      stages
        .filter((s) => !selectedCode || s.code === selectedCode)
        .flatMap((s) => (s.tasks ?? []).map((task) => task.id)),
    );
    return docs.filter((d) => {
      const isImage = (d.mimeType ?? '').startsWith('image/') || /\.(png|jpe?g|webp|gif|heic)$/i.test(d.fileName);
      if (!isImage) return false;
      if (!selectedCode) return true;
      const cat = d.category ?? '';
      if (taskIds.size === 0) return true;
      return [...taskIds].some((id) => cat.includes(id));
    });
  }, [docsQuery.data, selected?.code]);

  const overallTone: BoardTone = graph?.stages.some((st) => st.blockers?.length) ? 'error' : graph && graph.progressPercent >= 100 ? 'success' : 'info';

  return (
    <Board tone={overallTone}>
      <Board.Header
        title={title ?? t('workflow.orderSnapshot')}
        description={tFlow('productionFlow.stageDetails')}
        meta={graph ? <span className="tabular-nums" dir="ltr">{Math.round(graph.progressPercent)}%</span> : null}
      />
      {graph && graph.stages.length ? (
        <div className="border-b border-[var(--maher-border)] px-5 py-3">
          <Meter value={graph.progressPercent} max={100} size="sm" showValue={false} tone={overallTone === 'error' ? 'error' : 'info'} />
        </div>
      ) : null}
      <Board.Body>
        {graphQuery.isLoading ? (
          <BoardSkeleton rows={3} header={false} className="border-0 shadow-none" />
        ) : graphQuery.isError || !graph ? (
          <Board.Empty title={t('workflow.loadError')} description={t('workflow.retry')} className="px-0" />
        ) : graph.stages.length === 0 ? (
          <Board.Empty title={t('workflow.emptyStages')} className="px-0" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <ProductionFlowMap stages={flowStages} selectedId={selected?.id ?? null} onStageClick={(stage) => setSelectedId(stage.id)} rtl={rtl} />

            <aside className="rounded-[14px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-4">
              {selected ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stamp tone={stageTone(selected.status)} />
                    <p className="text-[14px] font-semibold text-[var(--maher-text-primary)]">{localizedName(locale, selected, selected.code)}</p>
                    <Stamp tone={stageTone(selected.status)} size="sm">
                      {(() => {
                        try {
                          return tStatus(selected.status as never);
                        } catch {
                          return selected.status;
                        }
                      })()}
                    </Stamp>
                    {selected.backForRework ? <Stamp tone="warning" size="sm">{t('workflow.backForRework')}</Stamp> : null}
                    {selected.isOptional ? <Stamp tone="neutral" size="sm">{t('workflow.optional')}</Stamp> : null}
                  </div>
                  {selected.progressPercent > 0 && selected.progressPercent < 100 ? <Meter value={selected.progressPercent} max={100} size="sm" tone="info" valueLabel={`${Math.round(selected.progressPercent)}%`} /> : null}
                  <KeyFacts
                    columns={2}
                    facts={[
                      { label: tFlow('productionFlow.workers'), value: selected.assignedEmployee?.name ?? tFlow('productionFlow.unassigned'), muted: !selected.assignedEmployee },
                      { label: t('plannedStart'), value: fmtWhen(selected.plannedStart ?? selected.actualStart, locale), ltr: true },
                      { label: t('plannedCompletion'), value: fmtWhen(selected.plannedEnd ?? selected.actualEnd, locale), ltr: true },
                      ...(selected.estimatedMinutes != null || selected.actualMinutes != null
                        ? [{ label: t('workflow.estimatedDuration'), value: selected.actualMinutes != null ? `${selected.actualMinutes} min` : `${selected.estimatedMinutes} min`, ltr: true }]
                        : []),
                    ]}
                  />
                  {selected.blockers?.length ? (
                    <ul className="m-0 list-none space-y-1 p-0">
                      {selected.blockers.map((b) => (
                        <li key={b.id} className="flex items-start gap-2 text-[12px] text-[var(--maher-error)]">
                          <Stamp tone="error" className="mt-1" />
                          {b.reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {selected.notes ? <p className="whitespace-pre-wrap text-[13px] leading-5 text-[var(--maher-text-secondary)]">{selected.notes}</p> : null}
                  <div>
                    <p className="mb-1.5 text-[12px] text-[var(--maher-text-tertiary)]">{tFlow('productionFlow.workPhotos')}</p>
                    {photos.length === 0 ? (
                      <p className="text-[12px] text-[var(--maher-text-tertiary)]">{tFlow('productionFlow.workPhotosEmpty')}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {photos.slice(0, 6).map((photo) => (
                          <button
                            key={photo.id}
                            type="button"
                            className="maher-press truncate rounded-[10px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-2 py-1.5 text-start text-[12px] hover:border-[var(--maher-border-strong)]"
                            onClick={async () => {
                              try {
                                const link = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${photo.id}/link`);
                                window.open(`${API_URL}${link.downloadPath}`, '_blank', 'noopener,noreferrer');
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            {photo.fileName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[var(--maher-text-secondary)]">{t('workflow.preview')}</p>
              )}
            </aside>
          </div>
        )}
      </Board.Body>
      {graph?.isLegacy ? (
        <Board.Footer>
          <span>{t('workflow.versionSuperseded')}</span>
        </Board.Footer>
      ) : null}
    </Board>
  );
}
