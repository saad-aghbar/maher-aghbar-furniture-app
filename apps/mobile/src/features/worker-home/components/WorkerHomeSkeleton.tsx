import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

export function WorkerHomeSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.lg }}
    >
      <SkeletonShimmer height={36} width="58%" />
      <SkeletonShimmer
        height={300}
        width="100%"
        style={{ borderRadius: theme.radius.xl }}
      />
      <SkeletonShimmer height={14} width="42%" />
      <SkeletonShimmer
        height={72}
        width="100%"
        style={{ borderRadius: theme.radius.lg }}
      />
      <SkeletonShimmer
        height={72}
        width="100%"
        style={{ borderRadius: theme.radius.lg }}
      />
      <SkeletonShimmer height={14} width="48%" />
      <SkeletonShimmer
        height={140}
        width="100%"
        style={{ borderRadius: theme.radius.xl }}
      />
      <SkeletonShimmer
        height={88}
        width="100%"
        style={{ borderRadius: theme.radius.lg }}
      />
    </View>
  );
}
