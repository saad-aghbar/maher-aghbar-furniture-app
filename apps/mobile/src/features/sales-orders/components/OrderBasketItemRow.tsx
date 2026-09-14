import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { OrderBasketItemModel } from '../selectOrderCard';

type Props = {
  item: OrderBasketItemModel;
  onPress: () => void;
};

const THUMB = 56;

/**
 * Nested commercial line inside an order basket board — not a nested board.
 */
export function OrderBasketItemRow({ item, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const kindLabel = t(`mobile.orders.journey.kind.${item.complexity}`);

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={`${item.title} ${kindLabel} ${item.fact}`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        minHeight: THUMB + theme.spacing.sm,
      }}
    >
      <ProductThumb uri={item.imageUrl} size={THUMB} radius={theme.radius.md} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText
          variant="label"
          weight={titleWeight}
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {item.title}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
              borderRadius: theme.radius.md,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.brand,
            }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={1}
              style={{ color: colors.brand, fontSize: 10, lineHeight: 12 }}
            >
              {kindLabel}
            </AppText>
          </View>
        </View>
        <AppText
          variant="caption"
          numberOfLines={1}
          dir="ltr"
          style={{
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {item.fact}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}

export const ORDER_BASKET_THUMB = THUMB;
