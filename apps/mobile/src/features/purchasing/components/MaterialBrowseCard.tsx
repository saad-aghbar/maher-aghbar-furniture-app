import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { InventorySkuThumb } from '@/features/inventory/components/InventorySkuThumb';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { BuilderMaterial } from '../orderBuilder';

type Props = {
  material: BuilderMaterial;
  selected?: boolean;
  onPress: () => void;
};

export function MaterialBrowseCard({ material, selected, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const low =
    material.minStock != null &&
    Number.isFinite(material.minStock) &&
    Number(material.onHandQty ?? 0) <= Number(material.minStock);
  const rail = low ? colors.warning : colors.brand;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.borderStrong,
        backgroundColor: selected ? colors.brandSoft : colors.surface,
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
          width: 3,
          backgroundColor: rail,
          opacity: low ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <InventorySkuThumb uri={material.imageUrl} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight={titleWeight} numberOfLines={1} style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {material.name}
          </AppText>
          <AppText variant="caption" color="muted" dir="ltr">
            {material.sku}
          </AppText>
        </View>
        <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end', gap: 4 }}>
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: low ? colors.warningSoft : colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.sm,
              minHeight: 24,
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" dir="ltr">
              {`${t('mobile.purchasing.onHand')} ${material.onHandQty ?? 0} ${material.unit}`}
            </AppText>
          </View>
          {selected ? (
            <AppText variant="caption" color="brand">
              {t('mobile.purchasing.inThisOrder')}
            </AppText>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}
