import { isTechnicalQueryError, sanitizeFeedbackCopy } from '@/api/toastErrors';
import { useLocale } from '@/i18n';
import { FloorStatus } from './FloorStatus';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const { t } = useLocale();
  const safeTitle = sanitizeFeedbackCopy(title, t('common.error'));
  const safeDescription =
    description && !isTechnicalQueryError(description) ? description : undefined;

  return (
    <FloorStatus
      tone="empty"
      title={safeTitle}
      description={safeDescription}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
