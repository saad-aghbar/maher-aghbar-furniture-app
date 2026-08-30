'use client';

import { Link } from '@/i18n/navigation';
import { Button, StatusBadge } from '@maher/ui';
import { History, Layers, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  title: string;
  isDraft: boolean;
  versionNumber?: number;
  onAddStage?: () => void;
  onPublish?: () => void;
  onVersions?: () => void;
  onValidate?: () => void;
  publishDisabled?: boolean;
  validatePending?: boolean;
  publishPending?: boolean;
};

export function WorkflowHeader({
  title,
  isDraft,
  versionNumber,
  onAddStage,
  onPublish,
  onVersions,
  onValidate,
  publishDisabled,
  validatePending,
  publishPending,
}: Props) {
  const t = useTranslations('production');

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href="/production/workflow" className="text-sm text-text-secondary hover:text-brand">
          ← {t('workflow.title')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isDraft ? (
            <StatusBadge
              status="DRAFT"
              label={t('workflow.editingDraft', { version: versionNumber ?? '—' })}
            />
          ) : (
            <StatusBadge status="PUBLISHED" label={t('workflow.viewingPublished')} />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onValidate ? (
          <Button variant="secondary" loading={validatePending} onClick={onValidate}>
            {t('workflow.preview')}
          </Button>
        ) : null}
        {onVersions ? (
          <Button variant="ghost" leadingIcon={<History className="h-4 w-4" />} onClick={onVersions}>
            {t('workflow.versionHistory')}
          </Button>
        ) : null}
        {onAddStage ? (
          <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={onAddStage}>
            {t('workflow.addStage')}
          </Button>
        ) : null}
        {onPublish ? (
          <Button loading={publishPending} onClick={onPublish} disabled={publishDisabled}>
            {t('workflow.publish')}
          </Button>
        ) : null}
        <Link href="/production/workflow/stages">
          <Button variant="ghost" leadingIcon={<Layers className="h-4 w-4" />}>
            {t('workflow.manageStages')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
