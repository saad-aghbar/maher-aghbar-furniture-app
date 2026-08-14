import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type LayoutChangeEvent,
  Pressable,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import {
  listInventoryItems,
  type InventoryCategoryGroup,
  type InventoryItem,
} from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { useLocale } from '@/i18n';
import { haptics, springs, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryLifecycle } from '../preferWarehouseForReceive';
import { InventorySheetFooter } from './InventorySheetFooter';
import { AppTextInput } from '@/components/forms/AppTextInput';
import {
  buildInventoryPickQuery,
  filterPickableItems,
  formatPickQty,
  inventoryPickCopyKey,
  selectInventoryPickRow,
  showsRawCategoryRail,
  type InventoryPickMode,
} from '../selectInventoryPick';

const CATEGORIES: InventoryCategoryGroup[] = [
  'fabric',
  'foam',
  'wood',
  'accessories',
];

const TRACK_PAD = 3;
const SEGMENT_H = 40;

type Props = {
  onPick: (item: InventoryItem) => void;
  onCancel: () => void;
  lifecycle: InventoryLifecycle;
  warehouseId: string;
  mode: InventoryPickMode;
  title?: string;
  /** Initial section focus for RAW materials (defaults to fabric). */
  initialCategory?: InventoryCategoryGroup;
};

/**
 * In-sheet inventory picker.
 * RAW keeps fabric / foam / wood / accessories.
 * SEMI / FG query production-generated items in the selected warehouse — no raw groups.
 */
export function InventoryItemPickPanel({
  onPick,
  onCancel,
  lifecycle,
  warehouseId,
  mode,
  title,
  initialCategory = 'fabric',
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const copy = inventoryPickCopyKey(lifecycle);
  const showCategories = showsRawCategoryRail(lifecycle);

  const [category, setCategory] = useState<InventoryCategoryGroup>(initialCategory);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [layouts, setLayouts] = useState<
    Partial<Record<InventoryCategoryGroup, { x: number; width: number }>>
  >({});

  const bubbleX = useSharedValue(0);
  const bubbleW = useSharedValue(0);
  const bubbleReady = useSharedValue(0);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const activeLayout = layouts[category];

  useEffect(() => {
    if (!showCategories || !activeLayout) return;
    if (reduce || bubbleReady.value === 0) {
      bubbleX.value = activeLayout.x;
      bubbleW.value = activeLayout.width;
      bubbleReady.value = 1;
      return;
    }
    bubbleX.value = withSpring(activeLayout.x, springs.snappy);
    bubbleW.value = withSpring(activeLayout.width, springs.snappy);
  }, [activeLayout, bubbleReady, bubbleW, bubbleX, reduce, showCategories]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleReady.value,
    transform: [{ translateX: bubbleX.value }],
    width: bubbleW.value,
  }));

  const groupLabel = t(`mobile.inventory.groups.${category}`);
  const searchPlaceholder =
    lifecycle === 'materials'
      ? t('mobile.inventory.searchPlaceholder', { group: groupLabel })
      : t(copy.searchPlaceholder);

  const pickQuery = warehouseId
    ? buildInventoryPickQuery({
        lifecycle,
        warehouseId,
        categoryGroup: showCategories ? category : undefined,
        q: debouncedQ || undefined,
      })
    : null;

  const itemsQuery = useQuery({
    queryKey: ['inventory-item-pick', pickQuery, mode],
    queryFn: () => listInventoryItems(pickQuery!),
    enabled: Boolean(pickQuery),
    staleTime: 15_000,
  });

  const rows = filterPickableItems(itemsQuery.data?.data ?? [], {
    warehouseId,
    mode,
  });

  function onSegmentLayout(key: InventoryCategoryGroup, event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[key];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });
  }

  function selectCategory(next: InventoryCategoryGroup) {
    if (next === category) return;
    void haptics.selection();
    setCategory(next);
    setQ('');
    setDebouncedQ('');
  }

  return (
    <View style={{ flex: 1, gap: theme.spacing.md }}>
      <AppText variant="heading">{title ?? t(copy.pickItem)}</AppText>

      {showCategories ? (
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            width: '100%',
            padding: TRACK_PAD,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: TRACK_PAD,
                height: SEGMENT_H,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                borderWidth: 1.5,
                borderColor: colors.brand,
              },
              bubbleStyle,
            ]}
          />
          {CATEGORIES.map((key) => {
            const active = category === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onLayout={(e) => onSegmentLayout(key, e)}
                onPress={() => selectCategory(key)}
                style={{
                  flex: 1,
                  minHeight: SEGMENT_H,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing.xs,
                  borderRadius: theme.radius.full,
                  zIndex: 1,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  numberOfLines={1}
                  color={active ? 'brand' : 'primary'}
                  style={{ textAlign: 'center' }}
                >
                  {t(`mobile.inventory.groups.${key}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <SearchBarShell>
        <AppTextInput
          value={q}
          onChangeText={setQ}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: theme.spacing.sm,
            color: colors.textPrimary,
            writingDirection: isRTL ? 'rtl' : 'ltr',
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
      </SearchBarShell>

      {!warehouseId ? (
        <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.md }}>
          <AppText variant="caption" color="secondary">
            {t('mobile.inventory.pickWarehouseFirst')}
          </AppText>
        </View>
      ) : itemsQuery.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: theme.spacing.lg }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}
          ListEmptyComponent={
            <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.md }}>
              <AppText variant="caption" color="secondary">
                {debouncedQ ? t('mobile.inventory.emptySearchBody') : t(copy.emptyBody)}
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const row = selectInventoryPickRow(item, warehouseId, locale);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void haptics.selection();
                  onPick(item);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: theme.radius.xl,
                  padding: theme.spacing.md,
                  backgroundColor: colors.surface,
                  gap: 2,
                  overflow: 'hidden',
                  ...theme.elevation.card,
                }}
              >
                <AppText variant="body" weight="semibold">
                  {row.name}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {row.sku}
                  {row.unit ? ` · ${row.unit}` : ''}
                  {` · ${t('mobile.inventory.pickFreeQty', {
                    qty: formatPickQty(row.freeQty),
                    unit: row.unit,
                  })}`}
                </AppText>
                {row.productName ? (
                  <AppText variant="caption" color="muted">
                    {row.productName}
                  </AppText>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <InventorySheetFooter onSecondary={onCancel} />
    </View>
  );
}
