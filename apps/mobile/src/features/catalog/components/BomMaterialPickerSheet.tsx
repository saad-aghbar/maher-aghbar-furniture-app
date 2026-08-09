import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  listMaterials,
  type AdminBomLine,
  type MaterialListItem,
} from '@/api/modules/catalogAdmin';
import {
  INVENTORY_CATEGORY_FOR_CREATE,
  type InventoryCategoryGroup,
} from '@/api/modules/inventory';
import { queryKeys } from '@/api/queryKeys';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import {
  AnimatedPressable,
  haptics,
  ListItemEnter,
  useDraggablePillBar,
  useReducedMotion,
} from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

const CATEGORIES: InventoryCategoryGroup[] = ['fabric', 'foam', 'wood', 'accessories'];

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

type Props = {
  open: boolean;
  onClose: () => void;
  existingSkus: string[];
  onPick: (line: AdminBomLine) => void;
};

/**
 * BOM material picker — four real inventory sections (fabric / foam / wood /
 * accessories) with a drag-scrub Fabric bubble, section search, and floor rows.
 */
export function BomMaterialPickerSheet({ open, onClose, existingSkus, onPick }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.72), 640);

  const [category, setCategory] = useState<InventoryCategoryGroup>('fabric');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
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
    }
  }, [open]);

  const activeIdx = Math.max(0, CATEGORIES.indexOf(category));
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const groupLabel = t(`mobile.inventory.groups.${category}`);

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

  const materialsQuery = useQuery({
    queryKey: queryKeys.catalog.materials({ q: debouncedQ, categoryGroup: category }),
    queryFn: () =>
      listMaterials({
        page: 1,
        pageSize: 80,
        q: debouncedQ || undefined,
        categoryGroup: category,
      }),
    enabled: open,
    staleTime: 15_000,
  });

  const rows = materialsQuery.data?.data ?? [];
  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  const enter = (index: number) =>
    reduce ? undefined : FadeInDown.delay(30 + index * 35).duration(220);

  const pick = (m: MaterialListItem) => {
    if (existingSkus.includes(m.sku)) return;
    void haptics.confirmLight();
    onPick({
      sku: m.sku,
      qty: 1,
      category: m.category ?? INVENTORY_CATEGORY_FOR_CREATE[category],
      unitCost: 0,
      lineCost: 0,
      nameEn: m.nameEn,
      nameAr: m.nameAr,
      materialId: m.id,
    });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('catalog.pickMaterial')}
      sheetHeight={sheetHeight}
      overlay
    >
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        <Animated.View entering={enter(0)}>
          <AppText
            variant="caption"
            color="muted"
            style={{
              marginTop: -theme.spacing.xs,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('catalog.pickMaterialHint')}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(1)}>
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
                      weight={focused ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'}
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
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <SearchBarShell>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('mobile.inventory.searchPlaceholder', { group: groupLabel })}
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
        </Animated.View>

        <Animated.View entering={enter(3)} style={{ flex: 1, minHeight: 0 }}>
          <View
            style={{
              flex: 1,
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
                {groupLabel}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr">
                {rows.length}
              </AppText>
            </View>

            {materialsQuery.isLoading ? (
              <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  padding: theme.spacing.sm,
                  gap: theme.spacing.sm,
                  paddingBottom: theme.spacing.md,
                }}
              >
                {rows.map((m, index) => {
                  const already = existingSkus.includes(m.sku);
                  const name =
                    locale === 'ar' ? m.nameAr || m.nameEn : m.nameEn || m.nameAr;
                  return (
                    <ListItemEnter key={m.id} index={index}>
                      <AnimatedPressable
                        variant="button"
                        accessibilityRole="button"
                        disabled={already}
                        onPress={() => pick(m)}
                        style={{
                          borderRadius: theme.radius.xl,
                          borderWidth: 1,
                          borderColor: already ? colors.border : colors.borderStrong,
                          backgroundColor: already
                            ? colors.surfaceSecondary
                            : colors.surfaceSecondary,
                          overflow: 'hidden',
                          opacity: already ? 0.55 : 1,
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
                            opacity: already ? 0.25 : 0.75,
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
                              backgroundColor: colors.brandSoft,
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
                              weight={locale === 'ar' ? 'medium' : 'semibold'}
                              numberOfLines={1}
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {name}
                            </AppText>
                            <AppText
                              variant="caption"
                              color="muted"
                              dir="ltr"
                              numberOfLines={1}
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {m.sku}
                              {already ? ` · ${t('catalog.materialAlreadyOnBom')}` : ''}
                            </AppText>
                          </View>
                          {!already ? (
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.borderStrong,
                              }}
                            >
                              <Ionicons name="add" size={16} color={colors.brand} />
                            </View>
                          ) : (
                            <Ionicons name="checkmark" size={18} color={colors.textMuted} />
                          )}
                        </View>
                      </AnimatedPressable>
                    </ListItemEnter>
                  );
                })}
                {rows.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: theme.spacing.xl,
                      paddingHorizontal: theme.spacing.lg,
                      alignItems: 'center',
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
                        : t('mobile.inventory.emptyMaterialsBody')}
                    </AppText>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </Animated.View>
      </View>
    </BottomSheet>
  );
}
