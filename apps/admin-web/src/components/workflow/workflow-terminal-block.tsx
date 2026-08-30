'use client';

import type { WorkflowEdge, WorkflowNode } from '@/components/workflow/workflow-types';
import { nodeLabel } from '@/lib/workflow-labels';
import {
  TERMINAL_STAGE_CODES,
  executionKindForNode,
  type TerminalStageCode,
} from '@/lib/workflow-terminal';
import { Badge, cn } from '@maher/ui';
import { ArrowRight, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

type Props = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedId?: string | null;
  onStageClick?: (node: WorkflowNode) => void;
  rtl?: boolean;
};

const DESC_KEYS: Record<TerminalStageCode, 'terminalInspectionDesc' | 'terminalPackagingDesc' | 'terminalDeliveryDesc'> =
  {
    INSPECTION: 'terminalInspectionDesc',
    PACKAGING: 'terminalPackagingDesc',
    DELIVERY: 'terminalDeliveryDesc',
  };

export function WorkflowTerminalBlock({ nodes, edges, selectedId, onStageClick, rtl }: Props) {
  const t = useTranslations('production.workflow');
  const locale = useLocale();

  const byCode = useMemo(
    () => new Map(nodes.map((n) => [n.stageDefinition.code, n] as const)),
    [nodes],
  );

  const terminalEdgeSet = useMemo(() => {
    const ids = new Set(
      nodes.filter((n) => TERMINAL_STAGE_CODES.includes(n.stageDefinition.code as TerminalStageCode)).map((n) => n.id),
    );
    return new Set(
      edges
        .filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId))
        .map((e) => `${e.fromNodeId}->${e.toNodeId}`),
    );
  }, [edges, nodes]);

  return (
    <div className="rounded-2xl border border-[var(--maher-border)] bg-[var(--maher-surface-muted)]/40 p-4">
      <div className="mb-4 flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{t('terminalTitle')}</h2>
          <p className="mt-0.5 text-xs text-text-secondary">{t('terminalHint')}</p>
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
        {TERMINAL_STAGE_CODES.map((code, index) => {
          const node = byCode.get(code);
          const name = node ? nodeLabel(locale, node) : t(`terminalStage.${code}`);
          const kind = node ? executionKindForNode(node) : code === 'DELIVERY' ? 'LOGISTICS' : code === 'INSPECTION' ? 'QUALITY' : 'PRODUCTION';
          const nextCode = TERMINAL_STAGE_CODES[index + 1];
          const linked =
            node && nextCode
              ? terminalEdgeSet.has(`${node.id}->${byCode.get(nextCode)?.id ?? ''}`)
              : false;

          return (
            <li key={code} className="contents">
              <button
                type="button"
                disabled={!node || !onStageClick}
                onClick={() => node && onStageClick?.(node)}
                className={cn(
                  'flex min-h-[7.5rem] flex-col rounded-xl border bg-[var(--maher-surface)] p-3 text-start transition',
                  node && onStageClick ? 'hover:border-brand/40 hover:shadow-sm' : 'cursor-default opacity-90',
                  selectedId === node?.id ? 'border-brand ring-1 ring-brand/30' : 'border-[var(--maher-border)]',
                  !node && 'border-dashed',
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <Lock className="h-3 w-3" aria-hidden />
                    {t('terminalLocked')}
                  </span>
                  {kind === 'QUALITY' ? (
                    <Badge variant="default">{t('terminalQualityBadge')}</Badge>
                  ) : kind === 'LOGISTICS' ? (
                    <Badge variant="warning">{t('terminalLogisticsBadge')}</Badge>
                  ) : null}
                </div>
                <p className="font-semibold text-text-primary">{name}</p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-text-secondary">
                  {t(DESC_KEYS[code])}
                </p>
                {!node ? (
                  <p className="mt-2 text-xs text-text-tertiary">{t('terminalMissing')}</p>
                ) : null}
              </button>
              {index < TERMINAL_STAGE_CODES.length - 1 ? (
                <div
                  className={cn(
                    'hidden items-center justify-center sm:flex',
                    linked ? 'text-brand' : 'text-text-tertiary',
                  )}
                  aria-hidden
                >
                  <ArrowRight className={cn('h-4 w-4', rtl && 'rotate-180')} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
