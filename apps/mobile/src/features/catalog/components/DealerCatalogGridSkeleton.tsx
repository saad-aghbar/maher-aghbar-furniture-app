import { View } from 'react-native';
import { DealerSkeleton } from '@/features/dealer-ui';
import { useTheme } from '@/theme';

/** Media-first 2-col placeholders matching elevated DealerProductCard. */
export function DealerCatalogGridSkeleton({ columns = 2 }: { columns?: number }) {
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
            backgroundColor: colors.surface,
            ...theme.elevation.rest,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <DealerSkeleton height={168} radius={0} />
          <View style={{ padding: theme.spacing.sm + 2, gap: 6 }}>
            <DealerSkeleton height={12} width="48%" />
            <DealerSkeleton height={36} width="92%" />
            <DealerSkeleton height={14} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}
