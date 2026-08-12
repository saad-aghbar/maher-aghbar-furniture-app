'use client';

import { apiFetch } from '@/lib/api-client';
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
}

interface OrderWorkflowGraph {
  productionOrderId: string;
  progressPercent: number;
  sourceVersionNumber: number | null;
  isLegacy: boolean;
  stages: OrderWorkflowStage[];
  edges: Array<{ from: string; to: string }>;
}

function fmtWhen(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function OrderWorkflowSection({ productionOrderId }: { productionOrderId: string }) {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const graphQuery = useQuery({
    queryKey: ['production-order-workflow', productionOrderId],
    queryFn: () =>
      apiFetch<OrderWorkflowGraph>(`/api/v1/production-orders/${productionOrderId}/workflow`),
  });

  const graph = graphQuery.data;
  const selected = graph?.stages.find((s) => s.id === selectedId) ?? null;

  const orderedStages = useMemo(() => {
    if (!graph) return [];
    const byCode = new Map(graph.stages.map((s) => [s.code, s]));
    const inDegree = new Map<string, number>();
    for (const s of graph.stages) inDegree.set(s.code, 0);
    for (const e of graph.edges) {
      if (!byCode.has(e.to)) continue;
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    }
    const roots = graph.stages.filter((s) => (inDegree.get(s.code) ?? 0) === 0);
    const visited = new Set<string>();
    const out: OrderWorkflowStage[] = [];
    const queue = [...roots];
    while (queue.length) {
      const node = queue.shift()!;
      if (visited.has(node.code)) continue;
      visited.add(node.code);
      out.push(node);
      for (const e of graph.edges.filter((edge) => edge.from === node.code)) {
        const next = byCode.get(e.to);
        if (next && !visited.has(next.code)) queue.push(next);
      }
    }
    for (const s of graph.stages) {
      if (!visited.has(s.code)) out.push(s);
    }
    return out;
  }, [graph]);

  return (
    <Card title={t('workflow.orderSnapshot')} description={t('workflow.subtitle')}>
      {graphQuery.isLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : graphQuery.isError || !graph ? (
        <EmptyState title={t('workflow.loadError')} description={t('workflow.retry')} />
      ) : graph.stages.length === 0 ? (
        <EmptyState title={t('workflow.emptyStages')} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative space-y-0">
            {orderedStages.map((stage, index) => {
              const name = localizedName(locale, stage, stage.code);
              const active = selectedId === stage.id;
              const isLast = index === orderedStages.length - 1;
              return (
                <div key={stage.id} className="relative flex gap-4 pb-6">
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedId(stage.id)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                        active
                          ? 'border-brand bg-brand text-white'
                          : 'border-border bg-surface text-text-secondary hover:border-brand'
                      }`}
                    >
                      {index + 1}
                    </button>
                    {!isLast ? (
                      <div className="mt-1 w-0.5 flex-1 min-h-[24px] bg-border" aria-hidden />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(stage.id)}
                    className={`flex-1 rounded-xl border p-3 text-start transition ${
                      active ? 'border-brand bg-brand-soft/30' : 'border-border hover:border-brand/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text-primary">{name}</p>
                      <StatusBadge status={stage.status} />
                      {stage.isOptional ? (
                        <Badge variant="warning">{t('workflow.optional')}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary" dir="ltr">
                      {stage.code}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>

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
                  {selected.assignedEmployee ? (
                    <div>
                      <dt className="text-xs text-text-tertiary">{t('assignedTo')}</dt>
                      <dd>{selected.assignedEmployee.name}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs text-text-tertiary">{t('plannedStart')}</dt>
                    <dd dir="ltr">{fmtWhen(selected.plannedStart ?? selected.actualStart)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-tertiary">{t('plannedCompletion')}</dt>
                    <dd dir="ltr">{fmtWhen(selected.plannedEnd ?? selected.actualEnd)}</dd>
                  </div>
                  {selected.actualMinutes != null ? (
                    <div>
                      <dt className="text-xs text-text-tertiary">{t('workflow.estimatedDuration')}</dt>
                      <dd dir="ltr">{selected.actualMinutes} min</dd>
                    </div>
                  ) : null}
                  {selected.notes ? (
                    <div>
                      <dt className="text-xs text-text-tertiary">{tCommon('notes')}</dt>
                      <dd className="whitespace-pre-wrap">{selected.notes}</dd>
                    </div>
                  ) : null}
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
