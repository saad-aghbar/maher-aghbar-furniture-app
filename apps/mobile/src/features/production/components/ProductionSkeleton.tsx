import { View } from 'react-native';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { productionBoardShadow } from '../productionFloorStyle';

export function ProductionListSkeleton() {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            minHeight: 120,
            opacity: 0.7,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...productionBoardShadow(colorScheme),
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
              height: 44,
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
                width: 64,
                height: 64,
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
              <View
                style={{
                  height: 8,
                  width: '100%',
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                }}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
