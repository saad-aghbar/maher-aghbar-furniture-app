'use client';

import { ProductionFlowMap, type FlowMapStage } from '@/components/workflow/production-flow-map';
import { apiFetch } from '@/lib/api-client';
import type { ProductStageEstimateRow } from '@/lib/scheduling';
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
    const nodes = version?.nodes ?? [];
    const edges = version?.edges ?? [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const deps = new Map<string, string[]>();
    for (const node of nodes) {
      const code = node.stageDefinition?.code ?? node.id;
      deps.set(code, []);
    }
    for (const edge of edges) {
      const from = byId.get(edge.fromNodeId);
      const to = byId.get(edge.toNodeId);
      const fromCode = from?.stageDefinition?.code ?? from?.id;
      const toCode = to?.stageDefinition?.code ?? to?.id;
      if (!fromCode || !toCode) continue;
      const list = deps.get(toCode) ?? [];
      list.push(fromCode);
      deps.set(toCode, list);
    }
    return nodes.map((node, index) => {
      const def = node.stageDefinition;
      const code = def?.code ?? node.id;
      const minutes = def?.id ? estimateMap.get(def.id) : undefined;
      return {
        id: node.id,
        code,
        name: def ? localizedName(locale, def, code) : code,
        status: minutes && minutes > 0 ? 'COMPLETED' : 'PENDING',
        progressPercent: minutes && minutes > 0 ? 100 : 0,
        dependsOnCodes: deps.get(code) ?? [],
        sortOrder: node.sortOrder ?? index,
        estimatedMinutes: minutes ?? node.estimatedMinutes ?? null,
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
