import { View } from 'react-native';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useTheme } from '@/theme';

export function InventoryGroupsSkeleton() {
  const { colors, theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <SurfaceCard key={i} style={{ minHeight: 108, opacity: 0.7 }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: theme.radius.md,
                backgroundColor: colors.surfaceSecondary,
              }}
            />
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <View
                style={{
                  height: 16,
                  width: '40%',
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
            </View>
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}

export function InventoryListSkeleton() {
  const { colors, theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <SurfaceCard key={i} style={{ minHeight: 88, opacity: 0.7 }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: theme.radius.md,
                backgroundColor: colors.surfaceSecondary,
              }}
            />
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <View
                style={{
                  height: 16,
                  width: '55%',
                  borderRadius: theme.radius.sm,
                  backgroundColor: colors.surfaceSecondary,
                }}
              />
              <View
                style={{
                  height: 12,
                  width: '35%',
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

export function InventoryDetailSkeleton() {
  const { colors, theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.md }}>
      <View
        style={{
          height: 28,
          width: '65%',
          borderRadius: theme.radius.sm,
          backgroundColor: colors.surfaceSecondary,
        }}
      />
      <SurfaceCard style={{ minHeight: 120, opacity: 0.7 }}>
        <View style={{ gap: theme.spacing.md }}>
          <View
            style={{
              height: 14,
              width: '40%',
              borderRadius: theme.radius.sm,
              backgroundColor: colors.surfaceSecondary,
            }}
          />
          <View
            style={{
              height: 14,
              width: '55%',
              borderRadius: theme.radius.sm,
              backgroundColor: colors.surfaceSecondary,
            }}
          />
        </View>
      </SurfaceCard>
    </View>
  );
}
