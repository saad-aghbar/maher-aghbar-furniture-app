import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onPress: () => void;
  activeCount?: number;
};

/**
 * Filled Army Camo pill + cream type — same chip as Home filter, not an outlined iOS capsule.
 */
export function OrdersFilterButton({ onPress, activeCount = 0 }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
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
        borderRadius: theme.radius.full,
        backgroundColor: colors.brand,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        ...theme.elevation.raised,
      }}
    >
      <Ionicons name="options-outline" size={16} color={colors.onBrand} />
      <AppText
        variant="label"
        weight={titleWeight}
        style={{ color: colors.onBrand }}
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
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.brandActive, fontSize: 11, lineHeight: 14 }}
          >
            {String(activeCount)}
          </AppText>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
