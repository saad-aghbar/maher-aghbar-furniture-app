import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type PurchasingWarehouseOption = {
  id: string;
  name: string;
  subtitle?: string;
};

type Props = {
  warehouses: PurchasingWarehouseOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  listHeight?: number;
};

/**
 * Floor rows for the purchasing warehouse filter — name + optional type, start rail when selected.
 */
export function PurchasingWarehousePickList({
  warehouses,
  selectedId,
  onSelect,
  listHeight = 280,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (warehouses.length === 0) {
    return (
      <DealerEmptyPanel
        nested
        compact
        icon="cube-outline"
        text={t('mobile.inventory.noWarehouses')}
      />
    );
  }

  const rowStride = theme.sizes.touch.min + theme.spacing.sm + 8;
  const viewportHeight = Math.min(
    listHeight,
    Math.max(rowStride, warehouses.length * rowStride),
  );

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={{ maxHeight: viewportHeight }}
      contentContainerStyle={{ gap: theme.spacing.sm }}
    >
      {warehouses.map((wh) => {
        const active = selectedId === wh.id;
        return (
          <AnimatedPressable
            key={wh.id || 'all'}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              void haptics.selection();
              onSelect(wh.id);
            }}
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? colors.brand : colors.borderStrong,
              backgroundColor: active ? colors.brandSoft : colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            {active ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 8,
                  bottom: 8,
                  width: 3,
                  borderRadius: 2,
                  backgroundColor: colors.brand,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
            ) : null}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: theme.sizes.touch.min,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                ...(isRTL
                  ? { paddingRight: theme.spacing.md + 4 }
                  : { paddingLeft: theme.spacing.md + 4 }),
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.surface : colors.brandSoft,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                }}
              >
                <Ionicons
                  name={wh.id ? 'cube-outline' : 'apps-outline'}
                  size={18}
                  color={active ? colors.brand : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <AppText
                  variant="label"
                  weight={active ? titleWeight : 'medium'}
                  numberOfLines={1}
                  style={{
                    color: active ? colors.brand : colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {wh.name}
                </AppText>
                {wh.subtitle ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    numberOfLines={1}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {wh.subtitle}
                  </AppText>
                ) : null}
              </View>
              {active ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brand,
                  }}
                >
                  <Ionicons name="checkmark" size={16} color={colors.onBrand} />
                </View>
              ) : (
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={colors.textMuted}
                />
              )}
            </View>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}
