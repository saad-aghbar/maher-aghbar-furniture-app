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
import { InventorySheetFooter } from './InventorySheetFooter';
import { AppTextInput } from '@/components/forms/AppTextInput';

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
  title?: string;
  /** Initial section focus (defaults to fabric). */
  initialCategory?: InventoryCategoryGroup;
};

/**
 * In-sheet material picker by inventory section (fabric / foam / wood / accessories).
 * No nested Modal — parent sheets are already Modals.
 */
export function InventoryItemPickPanel({
  onPick,
  onCancel,
  title,
  initialCategory = 'fabric',
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();

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
    if (!activeLayout) return;
    if (reduce || bubbleReady.value === 0) {
      bubbleX.value = activeLayout.x;
      bubbleW.value = activeLayout.width;
      bubbleReady.value = 1;
      return;
    }
    bubbleX.value = withSpring(activeLayout.x, springs.snappy);
    bubbleW.value = withSpring(activeLayout.width, springs.snappy);
  }, [activeLayout, bubbleReady, bubbleW, bubbleX, reduce]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleReady.value,
    transform: [{ translateX: bubbleX.value }],
    width: bubbleW.value,
  }));

  const groupLabel = t(`mobile.inventory.groups.${category}`);

  const itemsQuery = useQuery({
    queryKey: ['inventory-item-pick', category, debouncedQ],
    queryFn: () =>
      listInventoryItems({
        page: 1,
        pageSize: 80,
        categoryGroup: category,
        q: debouncedQ || undefined,
      }),
    staleTime: 15_000,
  });

  const rows = itemsQuery.data?.data ?? [];

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
      <AppText variant="heading">{title ?? t('mobile.inventory.pickItem')}</AppText>

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

      <SearchBarShell>
        <AppTextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('mobile.inventory.searchPlaceholder', { group: groupLabel })}
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

      {itemsQuery.isLoading ? (
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
                {debouncedQ
                  ? t('mobile.inventory.emptySearchBody')
                  : t('mobile.inventory.emptyMaterialsBody')}
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const name =
              locale === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;
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
                  {name}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {item.sku}
                  {item.unit ? ` · ${item.unit}` : ''}
                </AppText>
              </Pressable>
            );
          }}
        />
      )}

      <InventorySheetFooter onSecondary={onCancel} />
    </View>
  );
}
