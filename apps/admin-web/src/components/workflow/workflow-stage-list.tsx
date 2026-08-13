'use client';

import { Badge, cn } from '@maher/ui';
import { layoutStageGraph } from '@/lib/stage-graph-layout';
import type { FlowMapStage } from '@/components/workflow/production-flow-map';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  stages: FlowMapStage[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
};

export function WorkflowStageList({ stages, selectedId, onSelect }: Props) {
  const t = useTranslations('production');
  const ordered = useMemo(() => layoutStageGraph(stages).nodes, [stages]);

  if (!ordered.length) return null;

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-text-secondary">{t('workflow.stageList')}</h2>
      <ul className="divide-y divide-[var(--maher-border)] overflow-hidden rounded-xl border border-[var(--maher-border)]">
        {ordered.map((stage, index) => (
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
              <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{stage.name}</span>
              <Badge variant={stage.optional ? 'warning' : 'default'}>
                {stage.optional ? t('workflow.optional') : t('workflow.required')}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
