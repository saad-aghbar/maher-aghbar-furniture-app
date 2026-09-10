import { View } from 'react-native';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

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
        ...orderBoardShadow(colorScheme),
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
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
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
  );
}

export function PurchasingSkeleton({ count = 4 }: { count?: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {Array.from({ length: count }, (_, i) => (
        <FloorBone key={i} minHeight={96} />
      ))}
    </View>
  );
}
