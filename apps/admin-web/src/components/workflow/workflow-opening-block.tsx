'use client';

import type { WorkflowNode } from '@/components/workflow/workflow-types';
import { nodeLabel } from '@/lib/workflow-labels';
import { OPENING_STAGE_CODE } from '@/lib/workflow-terminal';
import { Badge, cn } from '@maher/ui';
import { Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type Props = {
  nodes: WorkflowNode[];
  selectedId?: string | null;
  onStageClick?: (node: WorkflowNode) => void;
  rtl?: boolean;
};

export function WorkflowOpeningBlock({ nodes, selectedId, onStageClick }: Props) {
  const t = useTranslations('production.workflow');
  const locale = useLocale();
  const node =
    nodes.find((n) => n.stageDefinition.code === OPENING_STAGE_CODE) ?? nodes[0] ?? null;
  const focused = node?.id === selectedId;

  return (
    <div className="rounded-2xl border border-[var(--maher-border)] bg-[var(--maher-surface)] p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 text-[var(--maher-brand)]" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{t('openingTitle')}</h3>
          <p className="text-xs text-text-secondary">{t('openingHint')}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={!node || !onStageClick}
        onClick={() => node && onStageClick?.(node)}
        className={cn(
          'w-full rounded-xl border p-3 text-start transition',
          focused ? 'border-[var(--maher-brand)]' : 'border-[var(--maher-border)]',
          !node && 'border-dashed opacity-80',
        )}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-text-tertiary" aria-hidden />
          <Badge variant="default">{t('openingLocked')}</Badge>
        </div>
        <p className="text-sm font-semibold text-text-primary">
          {node ? nodeLabel(locale, node) : t('materialPrepFallback')}
        </p>
        {!node ? <p className="mt-1 text-xs text-text-tertiary">{t('openingMissing')}</p> : null}
      </button>
    </div>
  );
}
