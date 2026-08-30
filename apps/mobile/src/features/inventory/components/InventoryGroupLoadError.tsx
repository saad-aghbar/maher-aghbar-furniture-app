import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ToastClearance } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';

type Props = {
  groupTitle: string;
  onRetry: () => void;
};

/**
 * Failed inventory group — landmark name + shared error chrome.
 * No list, skeleton, last-card inset, or invented stock behind the error.
 */
export function InventoryGroupLoadError({ groupTitle, onRetry }: Props) {
  const { t, locale } = useLocale();

  return (
    <View style={{ flex: 1 }}>
      <ToastClearance />
      <AppText variant="title" weight={locale === 'ar' ? 'medium' : 'semibold'}>
        {groupTitle}
      </AppText>
      <ErrorState
        title={t('mobile.inventory.errorTitle')}
        description={t('mobile.inventory.errorBody')}
        retryLabel={t('mobile.inventory.retry')}
        onRetry={onRetry}
      />
    </View>
  );
}
