import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

export function OrdersListSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}
    >
      {[0, 1, 2, 3].map((i) => (
        <SkeletonShimmer key={i} height={140} width="100%" />
      ))}
    </View>
  );
}
