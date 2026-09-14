import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type SkeletonLoaderProps = {
  rows?: number;
  rowHeight?: number;
};

export function SkeletonLoader({ rows = 3, rowHeight = 16 }: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const { t } = useLocale();

  return (
    <View
      accessibilityLabel={t('common.loading')}
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.md }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonShimmer
          key={i}
          height={rowHeight}
          width={i === rows - 1 ? '70%' : '100%'}
        />
      ))}
    </View>
  );
}
