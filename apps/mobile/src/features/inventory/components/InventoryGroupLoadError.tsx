import { ErrorState } from '@/components/feedback/ErrorState';
import { ToastClearance } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';

type Props = {
  groupTitle: string;
  onRetry: () => void;
};

/**
 * Failed inventory group — Gendy landmark in the error cluster,
 * human copy, filled retry. No list behind the error.
 */
export function InventoryGroupLoadError({ groupTitle, onRetry }: Props) {
  const { t } = useLocale();

  return (
    <>
      <ToastClearance />
      <ErrorState
        landmark={groupTitle}
        title={t('mobile.inventory.errorTitle')}
        description={t('mobile.inventory.errorBody')}
        retryLabel={t('mobile.inventory.retry')}
        onRetry={onRetry}
      />
    </>
  );
}
