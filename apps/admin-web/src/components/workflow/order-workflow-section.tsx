'use client';

import { ProductionFlowMap, type FlowMapStage } from '@/components/workflow/production-flow-map';
import { apiFetch, API_URL } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Badge, Card, EmptyState, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

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

function fmtWhen(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
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
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const rtl = locale === 'ar' || locale === 'he';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const graphQuery = useQuery({
    queryKey: ['production-order-workflow', productionOrderId],
    queryFn: () =>
      apiFetch<OrderWorkflowGraph>(`/api/v1/production-orders/${productionOrderId}/workflow`),
  });

  const docsQuery = useQuery({
    queryKey: ['production-order-docs', productionOrderId],
    queryFn: () =>
      apiFetch<{ documents?: ProductionDoc[]; stages?: Array<{ id: string; code: string; tasks?: Array<{ id: string }> }> }>(
        `/api/v1/production-orders/${productionOrderId}`,
      ),
  });

  const graph = graphQuery.data;
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

  return (
    <Card
      title={title ?? t('workflow.orderSnapshot')}
      description={tFlow('productionFlow.stageDetails')}
    >
      {graphQuery.isLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : graphQuery.isError || !graph ? (
        <EmptyState title={t('workflow.loadError')} description={t('workflow.retry')} />
      ) : graph.stages.length === 0 ? (
        <EmptyState title={t('workflow.emptyStages')} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <ProductionFlowMap
            stages={flowStages}
            selectedId={selected?.id ?? null}
            onStageClick={(stage) => setSelectedId(stage.id)}
            rtl={rtl}
          />

          <aside className="rounded-xl border border-border bg-surface-muted/50 p-4">
            {selected ? (
              <div className="space-y-3 text-sm">
                <p className="font-semibold text-text-primary">
                  {localizedName(locale, selected, selected.code)}
                </p>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs text-text-tertiary">{t('workflow.stageName')}</dt>
                    <dd>
                      <StatusBadge status={selected.status} />
                    </dd>
                  </div>
                  {selected.isOptional ? (
                    <Badge variant="warning">{t('workflow.optional')}</Badge>
                  ) : null}
                  <div>
                    <dt className="text-xs text-text-tertiary">{tFlow('productionFlow.workers')}</dt>
                    <dd>{selected.assignedEmployee?.name ?? tFlow('productionFlow.unassigned')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-tertiary">{t('plannedStart')}</dt>
                    <dd dir="ltr">{fmtWhen(selected.plannedStart ?? selected.actualStart)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-tertiary">{t('plannedCompletion')}</dt>
                    <dd dir="ltr">{fmtWhen(selected.plannedEnd ?? selected.actualEnd)}</dd>
                  </div>
                  {selected.estimatedMinutes != null || selected.actualMinutes != null ? (
                    <div>
                      <dt className="text-xs text-text-tertiary">{t('workflow.estimatedDuration')}</dt>
                      <dd dir="ltr">
                        {selected.actualMinutes != null
                          ? `${selected.actualMinutes} min`
                          : `${selected.estimatedMinutes} min`}
                      </dd>
                    </div>
                  ) : null}
                  {selected.blockers?.length ? (
                    <div>
                      <dt className="text-xs text-text-tertiary">{tFlow('productionFlow.blockers')}</dt>
                      <dd className="space-y-1">
                        {selected.blockers.map((b) => (
                          <p key={b.id} className="text-xs text-[var(--maher-error)]">
                            {b.reason}
                          </p>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  {selected.notes ? (
                    <div>
                      <dt className="text-xs text-text-tertiary">{tCommon('notes')}</dt>
                      <dd className="whitespace-pre-wrap">{selected.notes}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="mb-2 text-xs text-text-tertiary">{tFlow('productionFlow.workPhotos')}</dt>
                    <dd>
                      {photos.length === 0 ? (
                        <p className="text-xs text-text-tertiary">{tFlow('productionFlow.workPhotosEmpty')}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {photos.slice(0, 6).map((photo) => (
                            <button
                              key={photo.id}
                              type="button"
                              className="truncate rounded-lg border border-border px-2 py-1.5 text-start text-xs hover:border-brand/40"
                              onClick={async () => {
                                try {
                                  const link = await apiFetch<{ downloadPath: string }>(
                                    `/api/v1/uploads/documents/${photo.id}/link`,
                                  );
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
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">{t('workflow.preview')}</p>
            )}
          </aside>
        </div>
      )}
      {graph?.isLegacy ? (
        <p className="mt-3 text-xs text-text-tertiary">{t('workflow.versionSuperseded')}</p>
      ) : null}
    </Card>
  );
}
