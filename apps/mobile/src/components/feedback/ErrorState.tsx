import { useLocale } from '@/i18n';
import { FloorStatus } from './FloorStatus';

type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
}: ErrorStateProps) {
  const { t } = useLocale();
  const resolvedRetry = retryLabel ?? t('common.retry');

  return (
    <FloorStatus
      tone="error"
      title={title}
      description={description}
      actionLabel={onRetry ? resolvedRetry : undefined}
      onAction={onRetry}
    />
  );
}
