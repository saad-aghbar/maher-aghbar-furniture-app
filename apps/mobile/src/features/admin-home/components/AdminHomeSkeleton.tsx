import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

/** Management-desk skeleton — never flash zero tiles. */
export function AdminHomeSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.lg }}
    >
      <SkeletonShimmer height={48} width="100%" />
      <SkeletonShimmer height={14} width="28%" />
      <SkeletonShimmer height={96} width="100%" />
      <SkeletonShimmer height={96} width="94%" />
      <SkeletonShimmer height={14} width="22%" />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <SkeletonShimmer height={72} width={112} />
        <SkeletonShimmer height={72} width={112} />
        <SkeletonShimmer height={72} width={112} />
      </View>
      <SkeletonShimmer height={14} width="34%" />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <SkeletonShimmer height={64} width={108} />
        <SkeletonShimmer height={64} width={108} />
        <SkeletonShimmer height={64} width={108} />
      </View>
      <SkeletonShimmer height={88} width="100%" />
      <SkeletonShimmer height={88} width="100%" />
    </View>
  );
}
