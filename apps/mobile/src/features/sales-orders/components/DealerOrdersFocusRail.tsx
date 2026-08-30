import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { durations, withMotionDuration } from '@/motion/presets';
import { useTheme } from '@/theme';
import type { DealerFocusCounts } from '../stageCounts';
import type { StatusChipKey } from './OrdersFilterChips';
import { orderBoardShadow } from './orderFloorStyle';

type Props = {
  value: StatusChipKey;
  onChange: (next: StatusChipKey) => void;
  counts: DealerFocusCounts;
};

/** Dealer lifecycle focus board — All + drafts + 2×2 stage tiles including Shipped. */
const STAGE_ROWS: Exclude<StatusChipKey, 'all' | 'drafts' | 'pending'>[][] = [
  ['production', 'ready'],
  ['shipped', 'delivered'],
];

const TILE_SPRING = { damping: 18, stiffness: 220, mass: 0.85 } as const;

function accentFor(
  key: StatusChipKey,
  colors: {
    brand: string;
    info: string;
    warning: string;
    success: string;
  },
): string {
  if (key === 'drafts') return colors.brand;
  if (key === 'pending') return colors.warning;
  if (key === 'production') return colors.info;
  if (key === 'ready') return colors.brand;
  if (key === 'shipped') return colors.warning;
  if (key === 'delivered') return colors.success;
  return colors.brand;
}

function softWash(
  key: StatusChipKey,
  colors: {
    brandSoft: string;
    infoSoft: string;
    warningSoft: string;
    successSoft: string;
  },
  dark: boolean,
): string {
  if (dark) {
    if (key === 'drafts') return 'rgba(168,144,108,0.22)';
    if (key === 'pending') return 'rgba(196,137,122,0.18)';
    if (key === 'production') return 'rgba(122,148,170,0.18)';
    if (key === 'ready') return 'rgba(168,144,108,0.22)';
    if (key === 'shipped') return 'rgba(196,150,110,0.20)';
    if (key === 'delivered') return 'rgba(122,170,148,0.18)';
    return 'rgba(168,144,108,0.20)';
  }
  if (key === 'drafts') return colors.brandSoft;
  if (key === 'pending') return colors.warningSoft;
  if (key === 'production') return colors.infoSoft;
  if (key === 'ready') return colors.brandSoft;
  if (key === 'shipped') return colors.warningSoft;
  if (key === 'delivered') return colors.successSoft;
  return colors.brandSoft;
}

function countFor(key: StatusChipKey, counts: DealerFocusCounts): number {
  if (key === 'all') return counts.total;
  if (key === 'drafts') return counts.drafts;
  return counts[key];
}

type TileProps = {
  segment: StatusChipKey;
  label: string;
  count: number;
  focused: boolean;
  wide?: boolean;
  onPress: () => void;
};

function FocusTile({ segment, label, count, focused, wide, onPress }: TileProps) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const accent = accentFor(segment, colors);
  const wash = softWash(segment, colors, dark);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const scale = useSharedValue(1);
  const select = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    select.value = reduce
      ? focused
        ? 1
        : 0
      : withTiming(focused ? 1 : 0, {
          duration: withMotionDuration(durations.chip, reduce),
        });
  }, [focused, reduce, select]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: focused ? accent : colors.border,
    backgroundColor: focused
      ? wash
      : dark
        ? 'rgba(42,36,37,0.55)'
        : colors.surfaceSecondary,
  }));

  const countStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + select.value * 0.28,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${label}, ${count}`}
      onPressIn={() => {
        if (reduce) return;
        scale.value = withSpring(0.97, TILE_SPRING);
      }}
      onPressOut={() => {
        if (reduce) return;
        scale.value = withSpring(1, TILE_SPRING);
      }}
      onPress={onPress}
      style={wide ? undefined : { flex: 1 }}
    >
      <Animated.View
        style={[
          {
            minHeight: wide ? 54 : 72,
            borderRadius: theme.radius.lg,
            borderWidth: focused ? 1.5 : 1,
            overflow: 'hidden',
            paddingVertical: theme.spacing.sm + 2,
            paddingHorizontal: theme.spacing.md,
            justifyContent: wide ? 'center' : 'space-between',
            gap: 6,
            ...(focused
              ? {
                  shadowColor: accent,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: dark ? 0.28 : 0.14,
                  shadowRadius: 6,
                  elevation: 2,
                }
              : null),
          },
          animStyle,
        ]}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            backgroundColor: accent,
            opacity: focused ? 0.95 : 0.22,
          }}
        />

        <AppText
          variant="caption"
          weight={focused ? titleWeight : 'medium'}
          numberOfLines={1}
          style={{
            paddingStart: 6,
            color: focused ? accent : colors.textSecondary,
            fontSize: 12,
            lineHeight: 15,
            letterSpacing: locale === 'ar' ? 0 : 0.25,
            opacity: focused ? 1 : 0.88,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
          }}
        >
          {label}
        </AppText>

        <Animated.View style={[{ paddingStart: 6 }, countStyle]}>
          <AppText
            variant="title"
            weight="semibold"
            dir="ltr"
            style={{
              color: focused ? accent : colors.textPrimary,
              fontSize: wide ? 24 : 26,
              lineHeight: wide ? 28 : 30,
              fontVariant: ['tabular-nums'],
              letterSpacing: -0.4,
            }}
          >
            {String(count)}
          </AppText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Dealer focus board — All + 2×2 stage tiles, no horizontal scroll.
 */
export function DealerOrdersFocusRail({ value, onChange, counts }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';

  const enter = reduce
    ? undefined
    : FadeInDown.duration(withMotionDuration(durations.cardEnter, reduce)).springify();

  const select = (key: StatusChipKey) => {
    if (key === value) return;
    void haptics.selection();
    onChange(key);
  };

  const Board = (
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
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -48,
          ...(isRTL ? { left: -28 } : { right: -28 }),
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: dark ? 'rgba(168,144,108,0.12)' : colors.brandSoft,
          opacity: dark ? 1 : 0.5,
        }}
      />

      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />

      <View
        style={{
          gap: theme.spacing.sm + 2,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View style={{ gap: 3, paddingBottom: 2 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {t('mobile.orders.dealerFocusEyebrow')}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {t('mobile.orders.dealerFocusHint')}
          </AppText>
        </View>

        <FocusTile
          segment="all"
          label={t('mobile.orders.chips.all')}
          count={countFor('all', counts)}
          focused={value === 'all'}
          wide
          onPress={() => select('all')}
        />

        <FocusTile
          segment="drafts"
          label={t('mobile.orders.chips.drafts')}
          count={countFor('drafts', counts)}
          focused={value === 'drafts'}
          wide
          onPress={() => select('drafts')}
        />

        {STAGE_ROWS.map((row) => (
          <View
            key={row.join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {row.map((key) => (
              <FocusTile
                key={key}
                segment={key}
                label={
                  key === 'shipped'
                    ? t('lifecycle.shipped')
                    : key === 'production'
                      ? t('lifecycle.tabs.inProduction')
                      : key === 'ready'
                        ? t('lifecycle.tabs.ready')
                        : key === 'delivered'
                          ? t('lifecycle.tabs.delivered')
                          : t(`mobile.orders.chips.${key}`)
                }
                count={countFor(key, counts)}
                focused={value === key}
                onPress={() => select(key)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  if (!enter) return Board;
  return <Animated.View entering={enter}>{Board}</Animated.View>;
}
