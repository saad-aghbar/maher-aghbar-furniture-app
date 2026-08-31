import { View } from 'react-native';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { inventoryBoardShadow } from '../inventoryFloorStyle';

function FloorBone({ minHeight }: { minHeight: number }) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        minHeight,
        opacity: 0.7,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...inventoryBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.35,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          height: 40,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: theme.radius.lg,
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
        </View>
      </View>
    </View>
  );
}

export function InventoryGroupsSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <FloorBone key={i} minHeight={108} />
      ))}
    </View>
  );
}

export function InventoryListSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <FloorBone key={i} minHeight={88} />
      ))}
    </View>
  );
}

export function InventoryDetailSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.md }}>
      <FloorBone minHeight={120} />
      <FloorBone minHeight={100} />
    </View>
  );
}
