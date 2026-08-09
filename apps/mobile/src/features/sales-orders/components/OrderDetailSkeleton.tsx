import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

export function OrderDetailSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <SkeletonShimmer height={240} />
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
        <SkeletonShimmer height={28} width="55%" />
        <SkeletonShimmer height={16} width="40%" />
        <SkeletonShimmer height={12} />
        <SkeletonShimmer height={80} />
        <SkeletonShimmer height={80} />
      </View>
    </View>
  );
}
