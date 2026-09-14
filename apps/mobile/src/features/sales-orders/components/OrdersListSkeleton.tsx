import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export function OrdersListSkeleton() {
  const { theme } = useTheme();
  const { t } = useLocale();

  return (
    <View
      accessibilityLabel={t('common.loading')}
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}
    >
      {[0, 1, 2, 3].map((i) => (
        <SkeletonShimmer key={i} height={140} width="100%" />
      ))}
    </View>
  );
}
