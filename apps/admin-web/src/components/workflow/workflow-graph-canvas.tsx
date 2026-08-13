'use client';

import { ProductionFlowMap, type FlowMapStage } from '@/components/workflow/production-flow-map';
import { layoutStageGraph } from '@/lib/stage-graph-layout';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  stages: FlowMapStage[];
  selectedId?: string | null;
  onStageClick?: (stage: FlowMapStage) => void;
  rtl?: boolean;
};

export function WorkflowGraphCanvas({ stages, selectedId, onStageClick, rtl }: Props) {
  const t = useTranslations('production');
  const layout = useMemo(() => layoutStageGraph(stages), [stages]);
  const byCode = useMemo(() => new Map(stages.map((s) => [s.code, s])), [stages]);

  return (
    <div className="rounded-2xl border border-[var(--maher-border)] bg-[var(--maher-surface)] p-4">
      <ProductionFlowMap
        variant="editor"
        stages={stages}
        selectedId={selectedId}
        onStageClick={onStageClick}
        rtl={rtl}
        showDurations
      />
      <ol className="sr-only">
        {layout.nodes.map((node, index) => {
          const after = (node.dependsOnCodes ?? [])
            .map((code) => byCode.get(code)?.name)
            .filter(Boolean)
            .join(', ');
          return (
            <li key={node.id}>
              {after
                ? t('workflow.graphStageAfter', { n: index + 1, name: node.name, after })
                : t('workflow.graphStageStart', { n: index + 1, name: node.name })}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
