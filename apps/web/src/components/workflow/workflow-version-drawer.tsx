'use client';

import { WorkflowDrawer } from '@/components/workflow/workflow-drawer';
import { Button, StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

type VersionRow = { id: string; versionNumber: number; status: string };

type Props = {
  open: boolean;
  versions: VersionRow[];
  currentId?: string | null;
  onClose: () => void;
  onView: (id: string) => void;
  onCreateDraft: (fromVersionId: string) => void;
  createPending?: boolean;
};

export function WorkflowVersionDrawer({
  open,
  versions,
  currentId,
  onClose,
  onView,
  onCreateDraft,
  createPending,
}: Props) {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');

  return (
    <WorkflowDrawer
      open={open}
      title={t('workflow.versionHistory')}
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {tCommon('close')}
        </Button>
      }
    >
      <ul className="space-y-2">
        {versions.map((v) => (
          <li
            key={v.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--maher-border)] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">v{v.versionNumber}</span>
              <StatusBadge status={v.status} />
              {currentId === v.id ? (
                <span className="text-xs text-text-tertiary">{t('workflow.preview')}</span>
              ) : null}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onView(v.id)}>
                {t('workflow.viewVersion')}
              </Button>
              {v.status !== 'DRAFT' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={createPending}
                  onClick={() => onCreateDraft(v.id)}
                >
                  {t('workflow.createDraft')}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </WorkflowDrawer>
  );
}
