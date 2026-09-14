import { ActivityIndicator, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
};

export function ReportsListState({ title, loading, error, empty, emptyText, onRetry }: Props) {
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (error) {
    return <ErrorState title={t('common.loadFailed')} onRetry={onRetry} />;
  }
  if (loading) {
    return (
      <DealerBoard title={title} titleWeight={titleWeight}>
        <ActivityIndicator color={colors.brand} />
      </DealerBoard>
    );
  }
  if (empty) {
    return (
      <DealerBoard title={title} titleWeight={titleWeight}>
        <DealerEmptyPanel nested compact text={emptyText} />
      </DealerBoard>
    );
  }
  return null;
}
