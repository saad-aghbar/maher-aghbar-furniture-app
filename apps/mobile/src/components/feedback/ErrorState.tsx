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

  return (
    <FloorStatus
      tone="error"
      landmark={landmark}
      title={title}
      description={description}
      actionLabel={onRetry ? resolvedRetry : undefined}
      onAction={onRetry}
    />
  );
}
