import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryWarehouseOption } from './InventoryWarehousePickerControl';

/** Shared section card for inventory filter sheets (Orders aesthetic). */
export function InventoryFilterSection({
  title,
  icon,
  children,
  index,
  reduce,
  accent,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  index: number;
  reduce: boolean;
  accent?: string;
}) {
  const { theme, colors } = useTheme();
  const { isRTL } = useLocale();
  const body = (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        overflow: 'hidden',
      }}
    >
      {accent ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: 0.85,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: accent ? 4 : 0 }
            : { paddingLeft: accent ? 4 : 0 }),
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={icon} size={16} color={accent ?? colors.brand} />
        </View>
        <AppText
          variant="caption"
          style={{
            flex: 1,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            fontSize: 11,
            lineHeight: 14,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
      </View>
      <View
        style={{
          ...(isRTL
            ? { paddingRight: accent ? 4 : 0 }
            : { paddingLeft: accent ? 4 : 0 }),
        }}
      >
        {children}
      </View>
    </View>
  );
  if (reduce) return body;
  return (
    <Animated.View entering={FadeInDown.delay(40 + index * 40).duration(220)}>
      {body}
    </Animated.View>
  );
}

export function InventoryFloorChip({
  label,
  active,
  onPress,
  stretch,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  stretch?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        minWidth: stretch ? undefined : 96,
        flex: stretch ? 1 : undefined,
        maxWidth: stretch ? undefined : 168,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        minHeight: 40,
        borderRadius: theme.radius.lg,
        backgroundColor: active ? colors.brandSoft : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        overflow: 'hidden',
        alignItems: isRTL ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.85,
          }}
        />
      ) : null}
      <AppText
        variant="label"
        weight="semibold"
        numberOfLines={1}
        style={{
          color: active ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
          paddingLeft: active && !isRTL ? 4 : 0,
          paddingRight: active && isRTL ? 4 : 0,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

export function InventoryFilterSheetFooter({
  activeCount,
  onReset,
  onApply,
}: {
  activeCount: number;
  onReset: () => void;
  onApply: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: theme.spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
      }}
    >
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.inventory.filterReset')}
        onPress={() => {
          void haptics.selection();
          onReset();
        }}
        style={{
          flex: 1,
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.md,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <AppText variant="label" weight="medium" style={{ color: colors.textSecondary }}>
          {t('mobile.inventory.filterReset')}
        </AppText>
      </AnimatedPressable>

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.inventory.filterApply')}
        onPress={() => {
          void haptics.confirmLight();
          onApply();
        }}
        style={{
          flex: 1.35,
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: colors.brand,
          ...(colorScheme === 'dark'
            ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
              }
            : {
                shadowColor: colors.brand,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.28,
                shadowRadius: 12,
              }),
        }}
      >
        <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
          {activeCount > 0
            ? t('mobile.inventory.filterApplyWithCount', { n: String(activeCount) })
            : t('mobile.inventory.filterApply')}
        </AppText>
        <Ionicons name="checkmark" size={18} color={colors.onBrand} />
      </AnimatedPressable>
    </View>
  );
}

function warehouseDisplayName(w: InventoryWarehouseOption, locale: string): string {
  if (locale === 'ar') return w.nameAr || w.nameEn || w.code;
  return w.nameEn || w.nameAr || w.code;
}

/**
 * Searchable warehouse list — same pattern as Orders dealer picker.
 */
export function InventoryWarehouseSearchPicker({
  warehouses,
  selectedId,
  onSelect,
  resetToken,
}: {
  warehouses: InventoryWarehouseOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Clear search when the parent sheet opens/closes. */
  resetToken?: boolean | string | number;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [resetToken]);

  const selected = warehouses.find((w) => w.id === selectedId);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return warehouses;
    return warehouses.filter((w) => {
      const hay = [w.code, w.nameEn, w.nameAr].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [warehouses, needle]);

  const selectedLabel = selected
    ? warehouseDisplayName(selected, locale)
    : t('mobile.inventory.fgAllWarehouses');

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        }}
      >
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={1}
          style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
        >
          {selectedLabel}
        </AppText>
        {selectedId ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.inventory.fgAllWarehouses')}
            onPress={() => {
              void haptics.selection();
              onSelect(null);
            }}
            style={{
              paddingHorizontal: theme.spacing.sm,
              minHeight: 32,
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" weight="semibold" color="brand">
              {t('mobile.inventory.filterWarehouseClear')}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={t('mobile.inventory.filterWarehouseSearch')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          maxHeight: 200,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <WarehouseRow
            label={t('mobile.inventory.fgAllWarehouses')}
            active={!selectedId}
            isRTL={isRTL}
            onPress={() => {
              void haptics.selection();
              onSelect(null);
            }}
          />
          {filtered.map((w) => (
            <WarehouseRow
              key={w.id}
              label={warehouseDisplayName(w, locale)}
              active={selectedId === w.id}
              isRTL={isRTL}
              onPress={() => {
                void haptics.selection();
                onSelect(w.id);
              }}
            />
          ))}
          {filtered.length === 0 ? (
            <View style={{ padding: theme.spacing.md }}>
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.inventory.filterWarehouseEmpty')}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function WarehouseRow({
  label,
  active,
  isRTL,
  onPress,
}: {
  label: string;
  active: boolean;
  isRTL: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: theme.sizes.touch.min,
        paddingHorizontal: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        backgroundColor: active ? colors.brandSoft : 'transparent',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.85,
          }}
        />
      ) : null}
      <AppText
        variant="label"
        weight={active ? 'semibold' : 'medium'}
        numberOfLines={1}
        style={{
          flex: 1,
          color: active ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
          paddingLeft: active && !isRTL ? 4 : 0,
          paddingRight: active && isRTL ? 4 : 0,
        }}
      >
        {label}
      </AppText>
      {active ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
    </AnimatedPressable>
  );
}
