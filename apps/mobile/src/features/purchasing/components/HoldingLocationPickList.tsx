import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type HoldingLocationOption = {
  id: string;
  name: string;
  warehouseId: string;
};

type Props = {
  locations: HoldingLocationOption[];
  selectedId: string;
  onSelect: (location: HoldingLocationOption) => void;
  listHeight?: number;
};

/**
 * Floor rows for fabric holding — name only, no warehouse subtitle under it.
 */
export function HoldingLocationPickList({
  locations,
  selectedId,
  onSelect,
  listHeight = 280,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (locations.length === 0) {
    return (
      <DealerEmptyPanel
        nested
        compact
        icon="location-outline"
        text={t('mobile.purchasing.fabricHoldingEmpty')}
      />
    );
  }

  const rowStride = theme.sizes.touch.min + theme.spacing.sm;
  const viewportHeight = Math.min(
    listHeight,
    Math.max(theme.sizes.touch.min, locations.length * rowStride + theme.spacing.sm),
  );

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={{ maxHeight: viewportHeight }}
      contentContainerStyle={{ gap: theme.spacing.sm }}
    >
      {locations.map((loc) => {
        const active = selectedId === loc.id;
        return (
          <AnimatedPressable
            key={loc.id}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              void haptics.selection();
              onSelect(loc);
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
                  name="location-outline"
                  size={18}
                  color={active ? colors.brand : colors.textSecondary}
                />
              </View>
              <AppText
                variant="label"
                weight={active ? titleWeight : 'medium'}
                numberOfLines={1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: active ? colors.brand : colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {loc.name}
              </AppText>
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
