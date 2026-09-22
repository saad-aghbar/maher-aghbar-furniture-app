'use client';

import { Board, Button } from '@maher/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function WorkflowEmptyState({ onAdd }: { onAdd?: () => void }) {
  const t = useTranslations('production');
  return (
    <Board tone="neutral">
      <Board.Empty
        title={t('workflow.emptyStages')}
        description={t('workflow.emptyFirstStage')}
        action={
          onAdd ? (
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>
              {t('workflow.addStage')}
            </Button>
          ) : undefined
        }
      />
    </Board>
  );
}
