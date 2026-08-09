import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

export function DealerHomeSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.lg }}
    >
      <SkeletonShimmer height={36} width="65%" />
      <SkeletonShimmer height={18} width="40%" />
      <SkeletonShimmer height={160} width="100%" />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <SkeletonShimmer height={72} style={{ flex: 1 }} />
        <SkeletonShimmer height={72} style={{ flex: 1 }} />
        <SkeletonShimmer height={72} style={{ flex: 1 }} />
      </View>
      <SkeletonShimmer height={88} width="100%" />
      <SkeletonShimmer height={88} width="100%" />
    </View>
  );
}
