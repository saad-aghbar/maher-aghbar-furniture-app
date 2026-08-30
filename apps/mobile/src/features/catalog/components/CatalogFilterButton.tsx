import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { endEdge } from '@/i18n/rtl';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onPress: () => void;
  activeCount?: number;
};

/** Compact square filter control — mockup-style, brand theme. */
export function CatalogFilterButton({ onPress, activeCount = 0 }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const active = activeCount > 0;
  const size = theme.sizes.touch.min;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.catalog.filterTitle')}
      accessibilityState={{ selected: active }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <Ionicons
        name="options-outline"
        size={20}
        color={active ? colors.onBrand : colors.textSecondary}
      />
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            [endEdge(isRTL)]: 6,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 8,
            backgroundColor: colors.onBrand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.brand, fontSize: 9, lineHeight: 12 }}
          >
            {String(activeCount)}
          </AppText>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
