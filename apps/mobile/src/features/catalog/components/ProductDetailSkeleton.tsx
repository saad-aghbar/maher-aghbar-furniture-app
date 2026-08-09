import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

export function ProductDetailSkeleton() {
  const { theme, colors } = useTheme();
  return (
    <View>
      <SkeletonShimmer height={360} />
      <View
        style={{
          marginTop: -theme.spacing.lg,
          backgroundColor: colors.background,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        <SkeletonShimmer height={12} width="30%" />
        <SkeletonShimmer height={28} width="75%" />
        <SkeletonShimmer height={14} width="40%" />
        <SkeletonShimmer height={24} width="45%" />
        <SkeletonShimmer height={72} />
        <SkeletonShimmer height={120} />
      </View>
    </View>
  );
}
