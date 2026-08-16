import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { durations, withMotionDuration } from '@/motion/presets';
import { useTheme } from '@/theme';
import {
  filterFromSummaryKey,
  type DealerDeliveryFilter,
  type DealerSummaryTileKey,
} from '@/features/scheduling/selectDealerDeliveries';
import { orderBoardShadow } from './orderFloorStyle';

type Summary = {
  upcoming: number;
  thisWeek: number;
  awaitingConfirmation: number;
  mayBeDelayed: number;
};

type Props = {
  summary: Summary;
  filter?: DealerDeliveryFilter;
  onFilterChange?: (next: DealerDeliveryFilter) => void;
  selectedTile?: DealerSummaryTileKey | null;
  onSelectTile?: (key: DealerSummaryTileKey) => void;
  filters?: DealerDeliveryFilter[];
  filterLabel?: Record<DealerDeliveryFilter, string>;
};

const TILE_SPRING = { damping: 18, stiffness: 220, mass: 0.85 } as const;

function toneFor(
  key: DealerSummaryTileKey,
  colors: { brand: string; info: string; warning: string },
): string {
  if (key === 'week') return colors.info;
  if (key === 'awaiting' || key === 'delayed') return colors.warning;
  return colors.brand;
}

function washFor(
  key: DealerSummaryTileKey,
  colors: { brandSoft: string; infoSoft: string; warningSoft: string },
  dark: boolean,
): string {
  if (dark) {
    if (key === 'week') return 'rgba(122,148,170,0.18)';
    if (key === 'awaiting' || key === 'delayed') return 'rgba(196,137,122,0.18)';
    return 'rgba(168,144,108,0.22)';
  }
  if (key === 'week') return colors.infoSoft;
  if (key === 'awaiting' || key === 'delayed') return colors.warningSoft;
  return colors.brandSoft;
}

function SummaryTile({
  tileKey,
  label,
  count,
  focused,
  onPress,
}: {
  tileKey: DealerSummaryTileKey;
  label: string;
  count: number;
  focused: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const accent = toneFor(tileKey, colors);
  const wash = washFor(tileKey, colors, dark);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${label}, ${count}`}
      onPressIn={() => {
        if (!reduce) scale.value = withSpring(0.97, TILE_SPRING);
      }}
      onPressOut={() => {
        if (!reduce) scale.value = withSpring(1, TILE_SPRING);
      }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          {
            minHeight: 78,
            borderRadius: theme.radius.lg,
            borderWidth: focused ? 1.5 : 1,
            borderColor: focused ? accent : colors.border,
            backgroundColor: focused
              ? wash
              : dark
                ? 'rgba(42,36,37,0.55)'
                : colors.surfaceSecondary,
            overflow: 'hidden',
            paddingVertical: theme.spacing.sm + 2,
            paddingHorizontal: theme.spacing.md,
            justifyContent: 'space-between',
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
            opacity: focused ? 0.95 : count > 0 ? 0.35 : 0.16,
          }}
        />
        <AppText
          variant="caption"
          weight={focused ? titleWeight : 'medium'}
          numberOfLines={2}
          style={{
            paddingStart: 6,
            color: focused ? accent : colors.textSecondary,
            fontSize: 12,
            lineHeight: 15,
            letterSpacing: locale === 'ar' ? 0 : 0.25,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
          }}
        >
          {label}
        </AppText>
        <AppText
          variant="title"
          weight="semibold"
          dir="ltr"
          style={{
            paddingStart: 6,
            color: focused ? accent : colors.textPrimary,
            fontSize: 26,
            lineHeight: 30,
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.4,
          }}
        >
          {String(count)}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

export function DealerDeliverySummaryBoard({
  summary,
  filter = 'all',
  onFilterChange,
  selectedTile = null,
  onSelectTile,
  filters = [],
  filterLabel,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const interactive = Boolean(onSelectTile || onFilterChange);

  const selectTile = (key: DealerSummaryTileKey) => {
    void haptics.selection();
    if (onSelectTile) {
      onSelectTile(key);
      return;
    }
    if (!onFilterChange) return;
    const next = filterFromSummaryKey(key);
    onFilterChange(filter === next ? 'all' : next);
  };

  const tileFocused = (key: DealerSummaryTileKey) => {
    if (!interactive) return false;
    if (onSelectTile) return selectedTile === key;
    if (key === 'upcoming' || key === 'week') return filter === 'upcoming';
    if (key === 'delayed') return filter === 'attention' && summary.mayBeDelayed > 0;
    return filter === 'attention';
  };

  const selectFilter = (next: DealerDeliveryFilter) => {
    if (!onFilterChange || next === filter) return;
    void haptics.selection();
    onFilterChange(next);
  };

  const board = (
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
            {t('mobile.orders.deliveryEyebrow')}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {t(interactive ? 'mobile.orders.deliveryFocusHint' : 'mobile.orders.deliverySubtitle')}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <SummaryTile
            tileKey="upcoming"
            label={t('mobile.orders.summaryUpcoming')}
            count={summary.upcoming}
            focused={tileFocused('upcoming')}
            onPress={() => selectTile('upcoming')}
          />
          <SummaryTile
            tileKey="week"
            label={t('mobile.orders.summaryThisWeek')}
            count={summary.thisWeek}
            focused={tileFocused('week')}
            onPress={() => selectTile('week')}
          />
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <SummaryTile
            tileKey="awaiting"
            label={t('mobile.orders.summaryAwaiting')}
            count={summary.awaitingConfirmation}
            focused={tileFocused('awaiting')}
            onPress={() => selectTile('awaiting')}
          />
          <SummaryTile
            tileKey="delayed"
            label={t('mobile.orders.summaryDelayed')}
            count={summary.mayBeDelayed}
            focused={tileFocused('delayed')}
            onPress={() => selectTile('delayed')}
          />
        </View>

        {interactive && filterLabel ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
              paddingTop: 2,
            }}
          >
            {filters.map((key) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => selectFilter(key)}
                  style={{
                    minHeight: 32,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.full,
                    justifyContent: 'center',
                    backgroundColor: active ? colors.brand : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: active ? colors.onBrand : colors.textSecondary }}
                  >
                    {filterLabel[key]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (reduce) return board;
  return (
    <Animated.View entering={FadeInDown.duration(withMotionDuration(durations.cardEnter, reduce)).springify()}>
      {board}
    </Animated.View>
  );
}
