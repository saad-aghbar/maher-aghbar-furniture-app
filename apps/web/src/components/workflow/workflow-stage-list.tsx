'use client';

import { Badge, cn } from '@maher/ui';
import { layoutStageGraph } from '@/lib/stage-graph-layout';
import type { FlowMapStage } from '@/components/workflow/production-flow-map';
import {
  detectParallelBandLinks,
  toDomainGraph,
  type ParallelBandLinkMode,
} from '@/lib/workflow-domain-adapter';
import type { WorkflowEdge, WorkflowNode } from '@/components/workflow/workflow-types';
import { GitBranch, GitMerge, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  stages: FlowMapStage[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  lockedIds?: ReadonlySet<string>;
  /** Draft graph for parallel-band → parallel-band join controls. */
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  canEditBandLinks?: boolean;
  bandLinkSaving?: boolean;
  onBandLinkChange?: (args: {
    fromBandNodeIds: string[];
    toBandNodeIds: string[];
    mode: ParallelBandLinkMode;
  }) => void;
};

export function WorkflowStageList({
  stages,
  selectedId,
  onSelect,
  lockedIds,
  nodes,
  edges,
  canEditBandLinks = false,
  bandLinkSaving = false,
  onBandLinkChange,
}: Props) {
  const t = useTranslations('production');
  const ordered = useMemo(() => layoutStageGraph(stages).nodes, [stages]);

  const bandLinks = useMemo(() => {
    if (!nodes?.length || !edges) return [];
    return detectParallelBandLinks(toDomainGraph({ nodes, edges }));
  }, [nodes, edges]);

  const linkAfterNodeId = useMemo(() => {
    const map = new Map<string, (typeof bandLinks)[number]>();
    for (const link of bandLinks) {
      const fromSorted = [...link.fromBand.nodeIds].sort((a, b) => {
        const ao = ordered.findIndex((s) => s.id === a);
        const bo = ordered.findIndex((s) => s.id === b);
        return ao - bo;
      });
      const last = fromSorted[fromSorted.length - 1];
      if (last) map.set(last, link);
    }
    return map;
  }, [bandLinks, ordered]);

  if (!ordered.length) return null;

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-text-secondary">{t('workflow.stageList')}</h2>
      <ul className="divide-y divide-[var(--maher-border)] overflow-hidden rounded-xl border border-[var(--maher-border)]">
        {ordered.map((stage, index) => {
          const locked = lockedIds?.has(stage.id) ?? false;
          const link = canEditBandLinks ? linkAfterNodeId.get(stage.id) : undefined;
          return (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => onSelect(stage.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-[var(--maher-surface-muted)]',
                  selectedId === stage.id && 'bg-[var(--maher-brand-soft)]',
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--maher-brand-soft)] text-xs font-bold text-brand">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
                  {stage.name}
                </span>
                {locked ? (
                  <Badge variant="default">
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" aria-hidden />
                      {t('workflow.openingLocked')}
                    </span>
                  </Badge>
                ) : (
                  <Badge variant={stage.optional ? 'warning' : 'default'}>
                    {stage.optional ? t('workflow.optional') : t('workflow.required')}
                  </Badge>
                )}
              </button>
              {link && onBandLinkChange ? (
                <div className="space-y-1.5 border-t border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-3 py-2">
                  <p className="text-center text-[11px] text-text-secondary">
                    {t('workflow.bandLinkHint')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          mode: 'lanes' as const,
                          label: t('workflow.bandLinkLanes'),
                          Icon: GitBranch,
                        },
                        {
                          mode: 'together' as const,
                          label: t('workflow.bandLinkTogether'),
                          Icon: GitMerge,
                        },
                      ] as const
                    ).map(({ mode, label, Icon }) => {
                      const active = link.mode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          disabled={bandLinkSaving || (active && link.mode !== 'mixed')}
                          onClick={() =>
                            onBandLinkChange({
                              fromBandNodeIds: link.fromBand.nodeIds,
                              toBandNodeIds: link.toBand.nodeIds,
                              mode,
                            })
                          }
                          className={cn(
                            'inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium',
                            active
                              ? 'border-brand bg-[var(--maher-brand-soft)] text-brand'
                              : 'border-[var(--maher-border)] bg-[var(--maher-surface)] text-text-secondary',
                            bandLinkSaving && 'opacity-60',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {link.mode === 'mixed' ? (
                    <p className="text-center text-[11px] text-amber-700">
                      {t('workflow.bandLinkMixed')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
