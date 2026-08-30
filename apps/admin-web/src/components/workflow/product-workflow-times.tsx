'use client';

import { ProductionFlowMap, type FlowMapStage } from '@/components/workflow/production-flow-map';
import { apiFetch } from '@/lib/api-client';
import type { ProductStageEstimateRow } from '@/lib/scheduling';
import { workflowVersionToFlowStages } from '@/lib/workflow-labels';
import { localizedName } from '@maher/i18n';
import { Card, EmptyState, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type WorkflowNode = {
  id: string;
  sortOrder: number;
  estimatedMinutes?: number | null;
  stageDefinition?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    dependsOnCodes?: string[] | null;
  } | null;
};

type WorkflowEdge = { fromNodeId: string; toNodeId: string };

type WorkflowDetail = {
  id: string;
  activeVersion?: {
    id: string;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
  } | null;
};

function stageEstimateMinutes(row: ProductStageEstimateRow): number {
  const mode = row.quantityScalingMode ?? 'SETUP_PLUS_LINEAR';
  const setup = Number(row.setupMinutes ?? 0);
  const perUnit = Number(row.minutesPerUnit ?? 0);
  const fixed = Number(row.fixedMinutes ?? 0);
  if (mode === 'FIXED') return fixed;
  if (mode === 'LINEAR') return perUnit;
  if (fixed > 0 && setup === 0 && perUnit === 0) return fixed;
  return setup + perUnit;
}

export function ProductWorkflowTimes({
  productId,
  workflowId,
}: {
  productId: string;
  workflowId: string;
}) {
  const locale = useLocale();
  const t = useTranslations('mobile');
  const rtl = locale === 'ar' || locale === 'he';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const workflowQuery = useQuery({
    queryKey: ['production-workflow', workflowId],
    enabled: Boolean(workflowId),
    queryFn: () => apiFetch<WorkflowDetail>(`/api/v1/production-workflows/${workflowId}`),
  });

  const estimatesQuery = useQuery({
    queryKey: ['product-stage-estimates', productId],
    enabled: Boolean(productId),
    queryFn: () =>
      apiFetch<ProductStageEstimateRow[]>(`/api/v1/scheduling/products/${productId}/stage-estimates`),
  });

  const estimateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of estimatesQuery.data ?? []) {
      map.set(row.stageDefinitionId, stageEstimateMinutes(row));
    }
    return map;
  }, [estimatesQuery.data]);

  const stages: FlowMapStage[] = useMemo(() => {
    const version = workflowQuery.data?.activeVersion;
    if (!version) return [];
    const nodes = version.nodes ?? [];
    const edges = version.edges ?? [];
    return workflowVersionToFlowStages(nodes, edges, locale).map((s) => {
      const node = nodes.find((n) => n.id === s.id);
      const def = node?.stageDefinition;
      const displayCode = def?.code ?? s.id;
      const minutes = def?.id ? estimateMap.get(def.id) : undefined;
      return {
        ...s,
        // Keep layout code = node id so dependsOnCodes (node ids) still match.
        name: def ? localizedName(locale, def, displayCode) : displayCode,
        status: minutes && minutes > 0 ? 'COMPLETED' : 'PENDING',
        progressPercent: minutes && minutes > 0 ? 100 : 0,
        estimatedMinutes: minutes ?? node?.estimatedMinutes ?? null,
      };
    });
  }, [estimateMap, locale, workflowQuery.data?.activeVersion]);

  const selected = stages.find((s) => s.id === selectedId) ?? null;
  const total = stages.reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0);
  const missing = stages.filter((s) => !s.estimatedMinutes).length;

  if (!workflowId) return null;

  return (
    <Card
      title={t('production.workflow.productTimesTitle')}
      description={t('production.workflow.productTimesHint')}
    >
      {workflowQuery.isLoading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : workflowQuery.isError ? (
        <EmptyState title={t('production.workflow.loadError')} />
      ) : stages.length === 0 ? (
        <EmptyState title={t('production.workflow.emptyStages')} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary" dir="ltr">
            {t('production.workflow.totalProductionTime')}: {Math.round(total)} min
            {missing > 0 ? ` · ${t('production.workflow.stagesNeedTime', { count: missing })}` : ''}
          </p>
          <ProductionFlowMap
            stages={stages}
            selectedId={selected?.id ?? null}
            onStageClick={(stage) => setSelectedId(stage.id)}
            rtl={rtl}
            showDurations
          />
          {selected ? (
            <p className="text-sm text-text-secondary">
              {selected.name}
              {selected.estimatedMinutes
                ? ` · ${Math.round(selected.estimatedMinutes)} min`
                : ` · ${t('production.workflow.noProductionTimeYet')}`}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
