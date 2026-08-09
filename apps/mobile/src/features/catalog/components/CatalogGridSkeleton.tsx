import { View } from 'react-native';
import { SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';

/** Matches soft store cards (photo + name / subtitle / price). */
export function CatalogGridSkeleton({ columns = 2 }: { columns?: number }) {
  const { theme, colors } = useTheme();
  const gap = theme.spacing.md;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: columns === 2 ? '47%' : '100%',
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <SkeletonShimmer height={168} />
          <View style={{ padding: theme.spacing.md, gap: 6 }}>
            <SkeletonShimmer height={36} width="92%" />
            <SkeletonShimmer height={12} width="70%" />
            <SkeletonShimmer height={16} width="45%" />
          </View>
        </View>
      ))}
    </View>
  );
}
