import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

export function AdminHomeSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.lg }}
    >
      <SkeletonShimmer height={22} width="36%" />
      <SkeletonShimmer height={72} width="88%" />
      <SkeletonShimmer height={18} width="62%" />
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <SkeletonShimmer height={52} width="100%" />
        <SkeletonShimmer height={52} width="100%" />
        <SkeletonShimmer height={52} width="92%" />
        <SkeletonShimmer height={52} width="100%" />
      </View>
      <SkeletonShimmer height={88} width="94%" />
      <SkeletonShimmer height={88} width="94%" style={{ alignSelf: 'flex-end' }} />
    </View>
  );
}
