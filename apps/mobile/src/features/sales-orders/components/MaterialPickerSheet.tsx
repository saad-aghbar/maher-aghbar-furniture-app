import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  listInventoryItems,
  type InventoryCategoryGroup,
  type InventoryItem,
} from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter, useDraggablePillBar, useReducedMotion } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { orderBoardShadow } from './orderFloorStyle';

const CATEGORIES: InventoryCategoryGroup[] = [
  'fabric',
  'foam',
  'wood',
  'accessories',
];

const GROUP_ICON: Record<InventoryCategoryGroup, keyof typeof Ionicons.glyphMap> = {
  fabric: 'color-palette-outline',
  foam: 'layers-outline',
  wood: 'leaf-outline',
  accessories: 'construct-outline',
};

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 34;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#E9EBE3', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#5A6348', '#7A4538'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(181,164,140,0.20)',
  'rgba(154,170,122,0.18)',
  'rgba(196,137,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#9AAA7A', '#C4897A'] as const;

type ChipLayout = { x: number; width: number };

export type PickedOrderMaterial = {
  item: InventoryItem;
  categoryGroup: InventoryCategoryGroup;
  qty: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedOrderMaterial) => void;
  formatCurrency: (n: number) => string;
  /**
   * Open as a stacked overlay on top of another BottomSheet (avoids iOS
   * Modal dismiss/present races when Add material is pressed from create sheets).
   */
  overlay?: boolean;
};

/**
 * Mobile material picker — mirrors admin-web BomMaterialPicker:
 * category tiles → search → list with Add chip → qty confirm.
 */
export function MaterialPickerSheet({
  open,
  onClose,
  onPick,
  formatCurrency,
  overlay = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * (overlay ? 0.72 : 0.5)), 640);

  const [category, setCategory] = useState<InventoryCategoryGroup>('fabric');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState('1');
  const [layouts, setLayouts] = useState<Partial<Record<InventoryCategoryGroup, ChipLayout>>>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q, open]);

  useEffect(() => {
    if (!open) {
      setCategory('fabric');
      setQ('');
      setDebouncedQ('');
      setSelected(null);
      setQty('1');
      setLayouts({});
    }
  }, [open]);

  const activeIdx = Math.max(0, CATEGORIES.indexOf(category));
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  const orderedLayouts = useMemo(
    () => CATEGORIES.map((key) => layouts[key]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = CATEGORIES[index];
      if (!next || next === category) return;
      void haptics.selection();
      setCategory(next);
      setSelected(null);
      setQ('');
      setDebouncedQ('');
    },
    [category],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: open,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: InventoryCategoryGroup, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scale: 1 + dragging.value * 0.04 },
    ],
    width: pillW.value,
    backgroundColor: interpolateColor(hoverIndex.value, [0, 1, 2, 3], [...fills]),
    borderColor: interpolateColor(hoverIndex.value, [0, 1, 2, 3], [...borders]),
  }));

  const itemsQuery = useQuery({
    queryKey: ['order-material-pick', category, debouncedQ],
    queryFn: () =>
      listInventoryItems({
        page: 1,
        pageSize: 80,
        categoryGroup: category,
        q: debouncedQ || undefined,
      }),
    enabled: open,
    staleTime: 15_000,
  });

  const rows = itemsQuery.data?.data ?? [];

  const unitCost = useMemo(() => {
    if (!selected) return 0;
    return Number(selected.standardCost ?? 0) || 0;
  }, [selected]);

  const qtyNum = Number(qty);
  const lineTotal =
    Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum * unitCost : 0;

  function itemName(item: InventoryItem): string {
    if (locale === 'ar') return item.nameAr || item.nameEn || item.sku;
    if (locale === 'he') return item.nameEn || item.nameAr || item.sku;
    return item.nameEn || item.nameAr || item.sku;
  }

  function selectRow(item: InventoryItem) {
    void haptics.selection();
    setSelected(item);
    setQty('1');
  }

  function confirmAdd() {
    if (!selected) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return;
    onPick({ item: selected, categoryGroup: category, qty: n });
    void haptics.confirmLight();
    onClose();
  }

  function bumpQty(delta: number) {
    void haptics.selection();
    const cur = Number(qty);
    const next = Math.max(0.01, (Number.isFinite(cur) ? cur : 1) + delta);
    setQty(String(Number(next.toFixed(2))));
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.orderDetail.pickMaterial')}
      sheetHeight={sheetHeight}
      overlay={overlay}
    >
      <View style={{ flex: 1, gap: theme.spacing.sm }}>
        <GestureDetector gesture={gesture}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              height: shellH,
              borderRadius: shellH / 2,
              backgroundColor: dark ? 'rgba(42,36,37,0.92)' : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              paddingVertical: SHELL_PAD_Y,
              paddingHorizontal: SHELL_PAD_X,
              shadowColor: dark ? '#000000' : '#1E1A1B',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: dark ? 0.22 : 0.07,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: SHELL_PAD_Y,
                  height: PILL_HEIGHT,
                  left: 0,
                  borderRadius: PILL_HEIGHT / 2,
                  borderWidth: 1.5,
                  shadowColor: dark ? '#000000' : '#1E1A1B',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: dark ? 0.25 : 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                },
                pillStyle,
              ]}
            />
            {CATEGORIES.map((key) => {
              const focused = category === key;
              const label = t(`mobile.inventory.groups.${key}`);
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                  onLayout={(e) => onChipLayout(key, e)}
                  onPress={() => {
                    if (key === category) return;
                    void haptics.selection();
                    setCategory(key);
                    setSelected(null);
                    setQ('');
                    setDebouncedQ('');
                  }}
                  style={{
                    flex: 1,
                    height: PILL_HEIGHT,
                    paddingHorizontal: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    gap: 2,
                  }}
                >
                  <Ionicons
                    name={GROUP_ICON[key]}
                    size={14}
                    color={focused ? colors.brand : colors.textSecondary}
                  />
                  <AppText
                    variant="caption"
                    weight={focused ? titleWeight : 'medium'}
                    numberOfLines={1}
                    align="center"
                    style={{
                      color: focused ? colors.brand : colors.textSecondary,
                      fontSize: 11,
                      lineHeight: 14,
                      opacity: focused ? 1 : 0.85,
                    }}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </GestureDetector>

        <SearchBarShell>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('mobile.inventory.searchPlaceholder', {
              group: t(`mobile.inventory.groups.${category}`),
            })}
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

        <View
          style={{
            flex: 1,
            minHeight: 120,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: colors.surfaceSecondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}
          >
            <AppText
              variant="caption"
              style={{
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                fontSize: 11,
                color: colors.brand,
              }}
            >
              {t(`mobile.inventory.groups.${category}`)}
            </AppText>
            <AppText variant="caption" color="muted" dir="ltr">
              {String(rows.length)}
            </AppText>
          </View>

          {itemsQuery.isLoading ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.sm,
                padding: theme.spacing.xl,
              }}
            >
              <ActivityIndicator color={colors.brand} />
              <AppText variant="caption" color="muted">
                {t('mobile.orderDetail.loadingMaterials')}
              </AppText>
            </View>
          ) : rows.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: theme.spacing.xl,
                paddingHorizontal: theme.spacing.lg,
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name={GROUP_ICON[category]} size={20} color={colors.textMuted} />
              </View>
              <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                {debouncedQ
                  ? t('mobile.inventory.emptySearchBody')
                  : t('mobile.orderDetail.noMaterialsInSection')}
              </AppText>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: theme.spacing.sm,
                gap: theme.spacing.sm,
                paddingBottom: theme.spacing.md,
              }}
              renderItem={({ item, index }) => {
                const active = selected?.id === item.id;
                const cost = Number(item.standardCost ?? 0) || 0;
                return (
                  <ListItemEnter index={index}>
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => selectRow(item)}
                      style={{
                        borderRadius: theme.radius.xl,
                        borderWidth: active ? 1.5 : 1,
                        borderColor: active ? colors.brand : colors.borderStrong,
                        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                        overflow: 'hidden',
                        ...orderBoardShadow(colorScheme),
                      }}
                    >
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          top: 8,
                          bottom: 8,
                          ...(isRTL ? { right: 0 } : { left: 0 }),
                          width: 3,
                          borderRadius: 2,
                          backgroundColor: colors.brand,
                          opacity: active ? 1 : 0.55,
                        }}
                      />
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: theme.spacing.md,
                          paddingVertical: theme.spacing.md,
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
                            borderColor: colors.border,
                          }}
                        >
                          <Ionicons
                            name={GROUP_ICON[category]}
                            size={18}
                            color={colors.brand}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                          <AppText
                            variant="label"
                            weight={active ? titleWeight : 'medium'}
                            numberOfLines={1}
                            style={{
                              color: active ? colors.brand : colors.textPrimary,
                              textAlign: isRTL ? 'right' : 'left',
                            }}
                          >
                            {itemName(item)}
                          </AppText>
                          <AppText
                            variant="caption"
                            color="muted"
                            dir="ltr"
                            numberOfLines={1}
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                          >
                            {item.sku}
                            {item.unit ? ` · ${item.unit}` : ''}
                            {cost > 0 ? ` · ${formatCurrency(cost)}` : ''}
                          </AppText>
                        </View>
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: active ? colors.brand : colors.surface,
                            borderWidth: 1,
                            borderColor: active ? colors.brand : colors.borderStrong,
                          }}
                        >
                          <Ionicons
                            name={active ? 'checkmark' : 'add'}
                            size={16}
                            color={active ? colors.onBrand : colors.brand}
                          />
                        </View>
                      </View>
                    </AnimatedPressable>
                  </ListItemEnter>
                );
              }}
            />
          )}
        </View>

        {selected ? (
          <View
            style={{
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {itemName(selected)}
              {unitCost > 0 ? ` · ${formatCurrency(unitCost)}` : ''}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.surfaceSecondary,
                  overflow: 'hidden',
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AnimatedPressable
                  variant="button"
                  onPress={() => bumpQty(-1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.orderDetail.qtyDecrease')}
                  style={{
                    minWidth: theme.sizes.touch.min,
                    minHeight: theme.sizes.touch.min,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="title" weight="semibold">
                    −
                  </AppText>
                </AnimatedPressable>
                <TextInput
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={{
                    minWidth: 56,
                    textAlign: 'center',
                    color: colors.textPrimary,
                    fontSize: 16,
                    paddingVertical: theme.spacing.sm,
                    ...resolveAppFontStyle(locale, { variant: 'body', weight: 'semibold' }),
                  }}
                />
                <AnimatedPressable
                  variant="button"
                  onPress={() => bumpQty(1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.orderDetail.qtyIncrease')}
                  style={{
                    minWidth: theme.sizes.touch.min,
                    minHeight: theme.sizes.touch.min,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="title" weight="semibold">
                    +
                  </AppText>
                </AnimatedPressable>
              </View>
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
                <AppText variant="caption" color="muted">
                  {t('mobile.orderDetail.lineTotal')}
                </AppText>
                <AppText variant="label" weight="semibold">
                  {formatCurrency(lineTotal)}
                </AppText>
              </View>
            </View>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <SecondaryButton
                label={t('mobile.orderDetail.cancel')}
                onPress={onClose}
                style={{ flex: 1, borderRadius: theme.radius.xl }}
              />
              <PrimaryButton
                label={t('mobile.orderDetail.addMaterialTitle')}
                onPress={confirmAdd}
                style={{ flex: 1.4, borderRadius: theme.radius.xl }}
              />
            </View>
          </View>
        ) : (
          <SecondaryButton
            label={t('mobile.orderDetail.cancel')}
            onPress={onClose}
            style={{ borderRadius: theme.radius.xl }}
          />
        )}
      </View>
    </BottomSheet>
  );
}
