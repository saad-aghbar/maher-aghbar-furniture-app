import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onPress: () => void;
};

/** Parchment receive dock — icon well + wood fill, same family as invoice sticky. */
export function InventoryReceiveDock({ onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const label = t('mobile.inventory.receive');

  return (
    <View
      style={{
        minHeight: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor:
          colorScheme === 'dark' ? 'rgba(42,36,37,0.96)' : colors.surface,
        padding: 6,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          void haptics.confirmLight();
          onPress();
        }}
        style={{
          minHeight: 44,
          borderRadius: 22,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: colors.brand,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(245,241,234,0.18)',
          }}
        >
          <Ionicons name="download-outline" size={16} color={colors.onBrand} />
        </View>
        <AppText
          variant="label"
          weight={titleWeight}
          numberOfLines={1}
          style={{ color: colors.onBrand }}
        >
          {label}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}
