import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { InventorySkuThumb } from '@/features/inventory/components/InventorySkuThumb';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  index: number;
  name: string;
  sku: string;
  unitCostLabel: string;
  lineTotalLabel: string;
  qty: string;
  imageUrl?: string | null;
  /** Hide unit cost / line total (production setup — qty + remove only). */
  showCosts?: boolean;
  onQtyChange: (v: string) => void;
  onRemove: () => void;
};

/** BOM line on add-product and admin PDP — qty chip, unit cost, line total, remove. */
export function BomFloorRow({
  index,
  name,
  sku,
  unitCostLabel,
  lineTotalLabel,
  qty,
  imageUrl,
  showCosts = true,
  onQtyChange,
  onRemove,
}: Props) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const chipStyle = {
    flexShrink: 0 as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.75,
          }}
        />
        <View
          style={{
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.md,
            }}
          >
            <InventorySkuThumb uri={imageUrl} size={40} rounded="full" />

            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <AppText
                variant="label"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {name}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {showCosts ? `${t('catalog.unitCost')}: ${unitCostLabel}` : sku}
              </AppText>
            </View>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <View style={[chipStyle, { minWidth: 72 }]}>
              <AppTextInput
                value={qty}
                onChangeText={onQtyChange}
                keyboardType="decimal-pad"
                accessibilityLabel={t('catalog.qty')}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={{
                  minWidth: 40,
                  padding: 0,
                  margin: 0,
                  fontSize: theme.typography.variants.label.fontSize,
                  lineHeight: theme.typography.variants.label.lineHeight,
                  color: colors.brand,
                  textAlign: 'center',
                  ...resolveAppFontStyle(locale, {
                    variant: 'label',
                    weight: titleWeight,
                  }),
                }}
              />
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {showCosts ? (
                <View style={chipStyle}>
                  <AppText
                    variant="label"
                    weight={titleWeight}
                    dir="ltr"
                    style={{ color: colors.brand }}
                  >
                    {lineTotalLabel}
                  </AppText>
                </View>
              ) : null}

              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
                onPress={() => {
                  void haptics.selection();
                  onRemove();
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.errorSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </View>
    </ListItemEnter>
  );
}
