import { View } from 'react-native';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useTheme } from '@/theme';

export function ProductionListSkeleton() {
  const { colors, theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {[0, 1, 2].map((i) => (
        <SurfaceCard key={i} style={{ minHeight: 120, opacity: 0.7 }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: theme.radius.md,
                backgroundColor: colors.surfaceSecondary,
              }}
            />
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <View
                style={{
                  height: 16,
                  width: '50%',
                  borderRadius: theme.radius.sm,
                  backgroundColor: colors.surfaceSecondary,
                }}
              />
              <View
                style={{
                  height: 12,
                  width: '70%',
                  borderRadius: theme.radius.sm,
                  backgroundColor: colors.surfaceSecondary,
                }}
              />
              <View
                style={{
                  height: 8,
                  width: '100%',
                  borderRadius: theme.radius.sm,
                  backgroundColor: colors.surfaceSecondary,
                }}
              />
            </View>
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}
