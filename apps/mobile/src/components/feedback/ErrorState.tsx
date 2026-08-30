import { isTechnicalQueryError, sanitizeFeedbackCopy } from '@/api/toastErrors';
import { useLocale } from '@/i18n';
import { FloorStatus } from './FloorStatus';

type ErrorStateProps = {
  landmark?: string;
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  landmark,
  title,
  description,
  retryLabel,
  onRetry,
}: ErrorStateProps) {
  const { t } = useLocale();
  const resolvedRetry = retryLabel ?? t('common.retry');
  const safeTitle = sanitizeFeedbackCopy(title, t('common.error'));
  const safeDescription =
    description && !isTechnicalQueryError(description) ? description : undefined;

  return (
    <FloorStatus
      tone="error"
      landmark={landmark}
      title={safeTitle}
      description={safeDescription}
      actionLabel={onRetry ? resolvedRetry : undefined}
      onAction={onRetry}
    />
  );
}
