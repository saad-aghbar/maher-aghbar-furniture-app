import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { orderBoardShadow } from './orderFloorStyle';

type Props = {
  onPress: () => void;
  activeCount?: number;
};

/**
 * Floor-style filter trigger — soft elevation, brand ink when active.
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
        minHeight: 40,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.85,
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
          marginLeft: isRTL ? 0 : active ? 4 : 0,
          marginRight: isRTL ? (active ? 4 : 0) : 0,
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
