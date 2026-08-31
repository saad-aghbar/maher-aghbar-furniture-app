import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  count: number;
  groupLabel: string;
  topSkuName?: string | null;
  onPress: () => void;
};

/**
 * Low-stock warning board — parchment, warning rail, same recipe as other floors.
 */
export function InventoryLowStockFocus({
  count,
  groupLabel,
  topSkuName,
  onPress,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const chevron = isRTL ? 'arrow-back' : 'arrow-forward';

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.inventory.lowStockFocusA11y', {
        count,
        group: groupLabel,
      })}
      onPress={() => {
        void haptics.confirmLight();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.warning,
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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.warning,
          opacity: 0.9,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.warningSoft,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            color: colors.warning,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
          }}
        >
          {t('mobile.inventory.lowStockFocusEyebrow')}
        </AppText>
        <AppText variant="caption" color="brand" weight={titleWeight}>
          {t('mobile.inventory.lowStockFocusOpen')}
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <CountUp value={count} variant="largeTitle" color={colors.warning} />
        <View style={{ gap: 6 }}>
          <AppText
            variant="heading"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.inventory.lowStockFocusTitle', { group: groupLabel })}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {topSkuName
              ? t('mobile.inventory.lowStockFocusBodySku', { name: topSkuName })
              : t('mobile.inventory.lowStockFocusBody')}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            color="brand"
            style={{ flexShrink: 1 }}
          >
            {t('mobile.inventory.lowStockFocusCta')}
          </AppText>
          <Ionicons name={chevron} size={16} color={colors.brand} />
        </View>
      </View>
    </AnimatedPressable>
  );
}
