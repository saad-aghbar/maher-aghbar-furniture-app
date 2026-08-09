import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  canCreatePr: boolean;
  canCreatePo: boolean;
  fromLowStockLoading?: boolean;
  onFromLowStock: () => void;
  onNewRequest: () => void;
  onNewOrder: () => void;
};

/**
 * Three equal floor tiles in one row — low stock / new PR / new PO.
 * Compact captions + icons so they sit beside each other on phone width.
 */
export function PurchasingHeroActions({
  canCreatePr,
  canCreatePo,
  fromLowStockLoading,
  onFromLowStock,
  onNewRequest,
  onNewOrder,
}: Props) {
  const { isRTL } = useLocale();

  if (!canCreatePr && !canCreatePo) return null;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        gap: 8,
      }}
    >
      {canCreatePr ? (
        <HeroTile
          icon="flash-outline"
          labelKey="mobile.purchasing.actionLowStock"
          fallback="Low stock"
          a11yKey="catalog.fromLowStock"
          tone="soft"
          loading={fromLowStockLoading}
          onPress={onFromLowStock}
        />
      ) : null}
      {canCreatePr ? (
        <HeroTile
          icon="document-text-outline"
          labelKey="mobile.purchasing.actionNewRequest"
          fallback="New request"
          a11yKey="catalog.newPurchaseRequest"
          tone="soft"
          onPress={onNewRequest}
        />
      ) : null}
      {canCreatePo ? (
        <HeroTile
          icon="cart-outline"
          labelKey="mobile.purchasing.actionNewOrder"
          fallback="New order"
          a11yKey="catalog.newPurchaseOrder"
          tone="solid"
          onPress={onNewOrder}
        />
      ) : null}
    </View>
  );
}

function HeroTile({
  icon,
  labelKey,
  fallback,
  a11yKey,
  tone,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  fallback: string;
  a11yKey: string;
  tone: 'soft' | 'solid';
  loading?: boolean;
  onPress: () => void;
}) {
  const { t, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const solid = tone === 'solid';
  const ink = solid ? colors.onBrand : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const raw = t(labelKey);
  const label = raw === labelKey ? fallback : raw;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={t(a11yKey)}
      accessibilityState={{ busy: Boolean(loading), disabled: Boolean(loading) }}
      disabled={loading}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 72,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.sm + 2,
        borderRadius: theme.radius.xl,
        borderWidth: 1.5,
        borderColor: solid ? colors.brand : colors.borderStrong,
        backgroundColor: solid ? colors.brand : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {solid ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            start: 0,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
            opacity: 0.85,
          }}
        />
      )}
      {loading ? (
        <ActivityIndicator size="small" color={ink} />
      ) : (
        <>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: solid ? 'rgba(255,255,255,0.16)' : colors.brandSoft,
            }}
          >
            <Ionicons name={icon} size={15} color={ink} />
          </View>
          <AppText
            variant="caption"
            weight={titleWeight}
            align="center"
            numberOfLines={2}
            style={{
              color: ink,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: locale === 'ar' ? 0 : 0.2,
            }}
          >
            {label}
          </AppText>
        </>
      )}
    </AnimatedPressable>
  );
}
