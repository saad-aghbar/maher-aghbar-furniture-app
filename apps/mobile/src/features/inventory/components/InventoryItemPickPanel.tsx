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
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  listInventoryItems,
  type InventoryCategoryGroup,
  type InventoryItem,
} from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics, springs, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryLifecycle } from '../preferWarehouseForReceive';
import {
  buildInventoryPickQuery,
  filterPickableItems,
  formatPickQty,
  inventoryPickCopyKey,
  selectInventoryPickRow,
  showsRawCategoryRail,
  type InventoryPickMode,
  type InventoryPickRow,
} from '../selectInventoryPick';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventorySkuThumb } from './InventorySkuThumb';

const CATEGORIES: InventoryCategoryGroup[] = [
  'fabric',
  'foam',
  'wood',
  'accessories',
];

const TRACK_PAD = 3;
const SEGMENT_H = 40;
const THUMB = 72;

type Props = {
  onPick: (item: InventoryItem) => void;
  onCancel: () => void;
  lifecycle: InventoryLifecycle;
  warehouseId: string;
  mode: InventoryPickMode;
  title?: string;
  /** Initial section focus for RAW materials (defaults to fabric). */
  initialCategory?: InventoryCategoryGroup;
  /**
   * Parent operation sheet owns SELECT. When set, Scan QR closes the pick
   * overlay and runs the parent's always-mounted ScanInventoryItemAction.
   */
  onRequestScan?: () => void;
};

function PickFloorCard({
  row,
  index,
  fallbackIcon,
  onPress,
}: {
  row: InventoryPickRow;
  index: number;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mediaUri = resolveOrderMediaUri(row.imageUrl);

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: colors.brand,
              opacity: 0.55,
              zIndex: 1,
            }}
          />
          <AnimatedPressable
            variant="card"
            accessibilityRole="button"
            accessibilityLabel={row.name}
            onPress={onPress}
            style={{
              minHeight: theme.sizes.touch.min * 1.55,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
              paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <InventorySkuThumb
              uri={mediaUri}
              size={THUMB}
              fallback={fallbackIcon}
              rounded="lg"
            />
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <AppText
                variant="body"
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {row.name}
              </AppText>
              {row.productName ? (
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={1}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {row.productName}
                </AppText>
              ) : null}
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {row.sku}
                {row.unit ? ` · ${row.unit}` : ''}
              </AppText>
              <View
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  marginTop: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {t('mobile.inventory.pickFreeQty', {
                    qty: formatPickQty(row.displayQty),
                    unit: row.unit,
                  })}
                </AppText>
              </View>
            </View>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={18}
              color={colors.textMuted}
            />
          </AnimatedPressable>
        </View>
      </View>
    </ListItemEnter>
  );
}

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
  onRequestScan,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const copy = inventoryPickCopyKey(lifecycle);
  const showCategories = showsRawCategoryRail(lifecycle);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

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
      <AppText variant="heading" weight={titleWeight}>
        {title ?? t(copy.pickItem)}
      </AppText>

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

      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t(copy.searchLabel)}
      </AppText>
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

      {onRequestScan ? (
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText
            variant="caption"
            color="muted"
            style={{
              textAlign: 'center',
              paddingTop: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            {t('mobile.inventory.orScanQr')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.inventory.scanQr')}
            disabled={!warehouseId}
            onPress={() => {
              void haptics.selection();
              onRequestScan();
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              margin: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.brand,
              backgroundColor: colors.brandSoft,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              opacity: warehouseId ? 1 : 0.5,
            }}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.brand} />
            <AppText variant="label" weight="semibold" color="brand">
              {t('mobile.inventory.scanQr')}
            </AppText>
          </Pressable>
        </View>
      ) : null}

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
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}
          ListEmptyComponent={
            <View
              style={{
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.xl,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                alignItems: 'center',
              }}
            >
              <Ionicons name={copy.fallbackIcon} size={28} color={colors.textMuted} />
              <AppText variant="caption" color="secondary" style={{ textAlign: 'center' }}>
                {debouncedQ ? t('mobile.inventory.emptySearchBody') : t(copy.emptyBody)}
              </AppText>
            </View>
          }
          renderItem={({ item, index }) => {
            const row = selectInventoryPickRow(item, warehouseId, locale);
            return (
              <PickFloorCard
                row={row}
                index={index}
                fallbackIcon={copy.fallbackIcon}
                onPress={() => {
                  void haptics.selection();
                  onPick(item);
                }}
              />
            );
          }}
        />
      )}

      <InventorySheetFooter onSecondary={onCancel} />
    </View>
  );
}
