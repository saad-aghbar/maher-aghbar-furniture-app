import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onPress: () => void;
  activeCount?: number;
};

/**
 * Floor filter trigger — parchment idle, brand wash + start rail when active.
 * Compact header placement (no chevron).
 */
export function OrdersFilterButton({ onPress, activeCount = 0 }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const active = activeCount > 0;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.orders.filterTitle')}
      accessibilityState={{ selected: active }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 48,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surface,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        overflow: 'hidden',
        ...(active
          ? isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }
          : null),
        ...orderBoardShadow(colorScheme),
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.55,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.surface : colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: active ? colors.brand : colors.border,
        }}
      >
        <Ionicons
          name="options-outline"
          size={15}
          color={active ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="label"
        weight={titleWeight}
        style={{ color: active ? colors.brand : colors.textPrimary }}
      >
        {t('mobile.orders.filter')}
      </AppText>
      {active ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: 11,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.onBrand, fontSize: 11, lineHeight: 14 }}
          >
            {String(activeCount)}
          </AppText>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
