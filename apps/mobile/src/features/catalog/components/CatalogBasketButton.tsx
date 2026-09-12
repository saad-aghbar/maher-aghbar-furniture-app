import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { navigateToBasketReview } from '../newOrderDeepLink';
import { useOrderBasketCount } from '@/features/requests/OrderBasketProvider';

/** Count badge beside the catalog title — opens the basket. */
export function CatalogBasketButton() {
  const { t } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const count = useOrderBasketCount();
  const size = theme.sizes.touch.min;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.newOrder.basket')}
      onPress={() => {
        void haptics.selection();
        navigateToBasketReview(router);
      }}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <Ionicons name="bag-handle-outline" size={18} color={colors.brand} />
      {count > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 4,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: colors.onBrand, fontSize: 10 }}>
            {count > 9 ? '9+' : String(count)}
          </AppText>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
