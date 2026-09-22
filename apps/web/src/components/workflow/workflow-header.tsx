'use client';

import { Link } from '@/i18n/navigation';
import { Button, DetailHero, Menu } from '@maher/ui';
import { History, Layers, MoreHorizontal, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  code?: string;
  scope?: string | null;
  isDraft: boolean;
  versionNumber?: number;
  stageCount?: number;
  versionCount?: number;
  onAddStage?: () => void;
  onPublish?: () => void;
  onVersions?: () => void;
  onValidate?: () => void;
  publishDisabled?: boolean;
  validatePending?: boolean;
  publishPending?: boolean;
  children?: ReactNode;
};

/** Workflow builder identity board: back · code · title · draft/published stamp · facts · publish. */
export function WorkflowHeader({ title, code, scope, isDraft, versionNumber, stageCount, versionCount, onAddStage, onPublish, onVersions, onValidate, publishDisabled, validatePending, publishPending, children }: Props) {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');

  return (
    <DetailHero
      back={{ label: t('workflow.title'), href: '/admin/production/workflow' }}
      LinkComponent={Link}
      code={code}
      title={title}
      subtitle={scope === 'RETURN' ? t('workflow.scopeReturn') : t('workflow.scopeStandard')}
      status={isDraft ? { label: t('workflow.editingDraft', { version: versionNumber ?? '—' }), tone: 'warning' } : { label: t('workflow.viewingPublished'), tone: 'success' }}
      tone={isDraft ? 'warning' : 'success'}
      facts={[
        { label: t('workflow.activeVersion'), value: versionNumber != null ? `v${versionNumber}` : '—', ltr: true },
        { label: t('workflow.stages'), value: String(stageCount ?? 0), ltr: true },
        { label: t('workflow.versions'), value: String(versionCount ?? 1), ltr: true },
      ]}
      primary={
        onPublish ? (
          <Button loading={publishPending} onClick={onPublish} disabled={publishDisabled}>
            {t('workflow.publish')}
          </Button>
        ) : onAddStage ? (
          <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={onAddStage}>
            {t('workflow.addStage')}
          </Button>
        ) : undefined
      }
      actions={
        <>
          {onValidate ? (
            <Button variant="secondary" loading={validatePending} onClick={onValidate}>
              {t('workflow.preview')}
            </Button>
          ) : null}
          <Menu
            aria-label={tCommon('more')}
            trigger={<Button variant="secondary" aria-label={tCommon('more')}><MoreHorizontal className="h-4 w-4" /></Button>}
            items={[
              ...(onVersions ? [{ id: 'versions', label: t('workflow.versionHistory'), icon: <History className="h-4 w-4" />, onSelect: onVersions }] : []),
              { id: 'stages', label: t('workflow.manageStages'), icon: <Layers className="h-4 w-4" />, href: '/admin/production/workflow/stages' },
            ]}
            LinkComponent={Link}
          />
        </>
      }
    >
      {children}
    </DetailHero>
  );
}
