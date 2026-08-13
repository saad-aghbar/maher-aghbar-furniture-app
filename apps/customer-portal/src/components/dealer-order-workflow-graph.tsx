'use client';

import { ProductionFlowMap, type FlowMapStage } from '@/components/workflow/production-flow-map';
import { apiFetch, API_URL } from '@/lib/api-client';
import { StatusBadge, cn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type WorkflowStage = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  status: string;
  progressPercent: number;
  isSkipped?: boolean;
};

type WorkflowGraph = {
  productionOrderId: string;
  progressPercent: number;
  stages: WorkflowStage[];
  edges: Array<{ from: string; to: string }>;
};

type StagePhoto = {
  id: string;
  fileName: string;
  mimeType?: string | null;
};

function stageName(locale: string, stage: WorkflowStage): string {
  if (locale.startsWith('ar')) return stage.nameAr || stage.nameEn || stage.code;
  if (locale.startsWith('he')) return stage.nameHe || stage.nameEn || stage.code;
  return stage.nameEn || stage.nameAr || stage.code;
}

/** Dealer-safe dynamic workflow from GET /production-orders/:id/workflow */
export function DealerOrderWorkflowGraph({
  productionOrderId,
  fallbackStages,
  photos,
}: {
  productionOrderId: string;
  fallbackStages?: Array<{
    code: string;
    nameEn: string;
    nameAr: string;
    status: string;
    progressPercent: number;
  }>;
  photos?: StagePhoto[];
}) {
  const locale = useLocale();
  const tFlow = useTranslations('mobile');
  const rtl = locale === 'ar' || locale === 'he';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['dealer-order-workflow', productionOrderId],
    queryFn: () =>
      apiFetch<WorkflowGraph>(`/api/v1/production-orders/${productionOrderId}/workflow`),
  });

  const stages =
    query.data?.stages?.filter((s) => !s.isSkipped) ??
    fallbackStages?.map((s) => ({ ...s, id: s.code, nameHe: null })) ??
    [];
  const edges = query.data?.edges ?? [];

  const flowStages: FlowMapStage[] = useMemo(() => {
    const deps = new Map<string, string[]>();
    for (const s of stages) deps.set(s.code, []);
    for (const e of edges) {
      const list = deps.get(e.to) ?? [];
      list.push(e.from);
      deps.set(e.to, list);
    }
    return stages.map((s, index) => ({
      id: s.id || s.code,
      code: s.code,
      name: stageName(locale, s),
      status: s.status,
      progressPercent: s.progressPercent,
      dependsOnCodes: deps.get(s.code) ?? [],
      sortOrder: index,
    }));
  }, [edges, locale, stages]);

  const selected = stages.find((s) => (s.id || s.code) === selectedId) ?? stages[0] ?? null;
  const done = selected
    ? ['COMPLETED', 'DONE'].includes(String(selected.status).toUpperCase())
    : false;
  const visiblePhotos = done ? (photos ?? []) : [];

  if (query.isLoading && !fallbackStages?.length) {
    return <div className="h-24 animate-pulse rounded-xl bg-[var(--maher-surface-muted)]" />;
  }

  if (!flowStages.length) {
    return <p className="text-sm text-text-secondary">{tFlow('productionFlow.emptyTitle')}</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <ProductionFlowMap
        stages={flowStages}
        selectedId={selected ? selected.id || selected.code : null}
        onStageClick={(stage) => setSelectedId(stage.id)}
        rtl={rtl}
      />
      {selected ? (
        <aside className="rounded-xl border border-border bg-surface-muted/50 p-4 text-sm">
          <p className="font-semibold text-text-primary">{stageName(locale, selected)}</p>
          <div className="mt-2">
            <StatusBadge status={selected.status} />
          </div>
          <p className={cn('mt-2 text-xs text-text-tertiary')} dir="ltr">
            {selected.progressPercent}%
          </p>
          <div className="mt-3">
            <p className="mb-2 text-xs text-text-tertiary">{tFlow('productionFlow.workPhotos')}</p>
            {!done ? (
              <p className="text-xs text-text-tertiary">{tFlow('productionFlow.workPhotosPending')}</p>
            ) : visiblePhotos.length === 0 ? (
              <p className="text-xs text-text-tertiary">{tFlow('productionFlow.workPhotosEmpty')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visiblePhotos.slice(0, 6).map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="truncate rounded-lg border border-border px-2 py-1.5 text-start text-xs hover:border-brand/40"
                    onClick={async () => {
                      try {
                        const res = await apiFetch<{ downloadPath: string }>(
                          `/api/v1/uploads/documents/${photo.id}/link`,
                        );
                        window.open(`${API_URL}${res.downloadPath}`, '_blank', 'noopener,noreferrer');
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
        </aside>
      ) : null}
    </div>
  );
}
