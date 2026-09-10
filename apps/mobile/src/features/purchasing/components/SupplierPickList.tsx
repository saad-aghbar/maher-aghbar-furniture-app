import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  filterSuppliersByQuery,
  type PurchasingSupplierOption,
} from '../purchasingFilters';

type Props = {
  suppliers: PurchasingSupplierOption[];
  selectedId: string;
  onSelect: (supplier: PurchasingSupplierOption) => void;
  listHeight?: number;
};

/**
 * Inline supplier list for the add-material sheet — name only, no second popup.
 */
export function SupplierPickList({
  suppliers,
  selectedId,
  onSelect,
  listHeight = 280,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => filterSuppliersByQuery(suppliers, query),
    [suppliers, query],
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SearchBarShell>
        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.purchasing.searchSuppliers')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: theme.spacing.sm,
            fontSize: 16,
            color: colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
            ...resolveAppFontStyle(locale, { variant: 'body' }),
          }}
        />
      </SearchBarShell>

      {filtered.length === 0 ? (
        <DealerEmptyPanel
          nested
          compact
          icon="business-outline"
          text={t('mobile.purchasing.noSuppliersMatch')}
        />
      ) : (
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: listHeight }}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          {filtered.map((supplier) => {
            const active = selectedId === supplier.id;
            return (
              <AnimatedPressable
                key={supplier.id}
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void haptics.selection();
                  onSelect(supplier);
                }}
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? colors.brand : colors.borderStrong,
                  backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
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
                      name="business-outline"
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
                    {supplier.name}
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
      )}
    </View>
  );
}
