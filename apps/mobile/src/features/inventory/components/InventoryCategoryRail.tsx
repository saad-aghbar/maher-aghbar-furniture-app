import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { rowDirection, startEdge } from '@/i18n/rtl';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryCategoryGroup, InventoryGroupSummary } from '../api';

const ORDER: InventoryCategoryGroup[] = ['fabric', 'foam', 'wood', 'accessories'];

const GROUP_ICON: Record<InventoryCategoryGroup, keyof typeof Ionicons.glyphMap> = {
  fabric: 'color-palette-outline',
  foam: 'layers-outline',
  wood: 'leaf-outline',
  accessories: 'construct-outline',
};

/** Compact tile — title + count (+ optional low-stock line). */
const TILE_HEIGHT = 72;

type Props = {
  groups: InventoryGroupSummary[];
  active: InventoryCategoryGroup;
  onChange: (group: InventoryCategoryGroup) => void;
};

/**
 * Floor category boards — soft shell, compact equal tiles.
 * Zero counts stay visible: a failed load really is 0 on hand.
 */
export function InventoryCategoryRail({ groups, active, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const byKey = new Map(groups.map((g) => [g.categoryGroup, g]));
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const totalMaterials = ORDER.reduce(
    (sum, key) => sum + (byKey.get(key)?.materialCount ?? 0),
    0,
  );

  return (
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
      <View
        style={{
          flexDirection: rowDirection(isRTL),
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            fontSize: 11,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.inventory.categoryRail')}
        </AppText>
        <AppText
          variant="caption"
          dir="ltr"
          style={{ fontSize: 11, color: colors.textPrimary }}
        >
          {String(totalMaterials)}
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.sm,
          flexDirection: rowDirection(isRTL),
          flexWrap: 'wrap',
          gap: theme.spacing.xs + 2,
        }}
      >
        {ORDER.map((key, index) => {
          const g = byKey.get(key);
          const lowCount = g?.lowStockCount ?? 0;
          return (
            <CategoryChip
              key={key}
              icon={GROUP_ICON[key]}
              label={t(`mobile.inventory.groups.${key}`)}
              itemsLabel={t('mobile.inventory.materialCount', {
                count: g?.materialCount ?? 0,
              })}
              lowLabel={
                lowCount > 0
                  ? t('mobile.inventory.lowStockCount', { count: lowCount })
                  : null
              }
              active={active === key}
              titleWeight={titleWeight}
              reduce={Boolean(reduce)}
              index={index}
              onPress={() => {
                void haptics.selection();
                onChange(key);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function CategoryChip({
  icon,
  label,
  itemsLabel,
  lowLabel,
  active,
  titleWeight,
  reduce,
  index,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  itemsLabel: string;
  lowLabel: string | null;
  active: boolean;
  titleWeight: 'medium' | 'semibold';
  reduce: boolean;
  index: number;
  onPress: () => void;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const stamp = useSharedValue(reduce ? 1 : 0);
  const sheen = useSharedValue(0);
  const hasLow = Boolean(lowLabel);
  const stripColor = hasLow && !active ? colors.warning : colors.brand;

  useEffect(() => {
    if (reduce) {
      stamp.value = 1;
      return;
    }
    stamp.value = withDelay(
      50 + index * 32,
      withSpring(1, { damping: 18, stiffness: 180 }),
    );
  }, [index, reduce, stamp]);

  useEffect(() => {
    if (reduce || !active) {
      sheen.value = 0;
      return;
    }
    sheen.value = 0;
    sheen.value = withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) });
  }, [active, reduce, sheen]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ scale: interpolate(stamp.value, [0, 1], [0.97, 1]) }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.45, 1], [0, 0.1, 0]),
    transform: [
      {
        translateX: interpolate(sheen.value, [0, 1], isRTL ? [48, -80] : [-48, 80]),
      },
    ],
  }));

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}. ${itemsLabel}${lowLabel ? `. ${lowLabel}` : ''}`}
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        maxWidth: '48%',
        height: TILE_HEIGHT,
        borderRadius: theme.radius.lg,
        borderWidth: active ? 1.5 : 1,
        borderColor: active
          ? colors.brand
          : hasLow
            ? colors.warning
            : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 6,
          bottom: 6,
          [startEdge(isRTL)]: 0,
          width: 2.5,
          borderRadius: 2,
          backgroundColor: stripColor,
          opacity: active || hasLow ? 0.9 : 0.35,
        }}
      />
      {active && !reduce ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 22,
              backgroundColor: colors.brand,
            },
            sheenStyle,
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          {
            flex: 1,
            flexDirection: rowDirection(isRTL),
            alignItems: 'center',
            gap: theme.spacing.xs + 2,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.sm + 4 }
              : { paddingLeft: theme.spacing.sm + 4 }),
          },
          stampStyle,
        ]}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? colors.surface : colors.brandSoft,
            borderWidth: 1,
            borderColor: active ? colors.brand : colors.border,
          }}
        >
          <Ionicons
            name={icon}
            size={14}
            color={active ? colors.brand : colors.textSecondary}
          />
        </View>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 1,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={1}
            style={{
              color: active ? colors.brand : colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              fontSize: 13,
              lineHeight: 16,
            }}
          >
            {label}
          </AppText>
          <AppText
            variant="caption"
            weight="regular"
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              fontSize: 10,
              lineHeight: 13,
            }}
          >
            {itemsLabel}
          </AppText>
          <AppText
            variant="caption"
            weight="medium"
            numberOfLines={1}
            style={{
              textAlign: isRTL ? 'right' : 'left',
              fontSize: 10,
              lineHeight: 12,
              color: colors.warning,
              opacity: hasLow ? 1 : 0,
            }}
          >
            {lowLabel ?? '—'}
          </AppText>
        </View>
      </Animated.View>
    </AnimatedPressable>
  );
}
