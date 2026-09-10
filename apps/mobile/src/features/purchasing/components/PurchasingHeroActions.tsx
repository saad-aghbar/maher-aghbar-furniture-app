import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  canCreatePo: boolean;
  canReadSuppliers: boolean;
  onNewOrder: () => void;
  onLowStock: () => void;
  onSuppliers: () => void;
};

export function PurchasingHeroActions({
  canCreatePo,
  canReadSuppliers,
  onNewOrder,
  onLowStock,
  onSuppliers,
}: Props) {
  if (!canCreatePo && !canReadSuppliers) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 8,
      }}
    >
      {canCreatePo ? (
        <HeroTile
          icon="cart-outline"
          labelKey="mobile.purchasing.actionNewOrder"
          a11yKey="catalog.newPurchaseOrder"
          tone="solid"
          onPress={onNewOrder}
        />
      ) : null}
      {canCreatePo ? (
        <HeroTile
          icon="flash-outline"
          labelKey="mobile.purchasing.actionLowStock"
          a11yKey="catalog.fromLowStock"
          tone="soft"
          onPress={onLowStock}
        />
      ) : null}
      {canReadSuppliers ? (
        <HeroTile
          icon="people-outline"
          labelKey="mobile.purchasing.actionSuppliers"
          a11yKey="mobile.purchasing.suppliers"
          tone="soft"
          onPress={onSuppliers}
        />
      ) : null}
    </View>
  );
}

function HeroTile({
  icon,
  labelKey,
  a11yKey,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  a11yKey: string;
  tone: 'soft' | 'solid';
  onPress: () => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const solid = tone === 'solid';
  const ink = solid ? colors.onBrand : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const label = t(labelKey);

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={t(a11yKey)}
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
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
