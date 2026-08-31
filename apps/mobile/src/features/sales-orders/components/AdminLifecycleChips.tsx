import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme, type ThemeColors } from '@/theme';
import {
  adminLifecycleHumanLabel,
  adminLifecyclePhaseHint,
  type AdminOrderLifecycle,
} from '../adminOrderLifecycle';

export type AdminLifecycleChipKey = 'all' | Exclude<AdminOrderLifecycle, 'rfq' | 'needs_attention'>;

export const ADMIN_LIFECYCLE_CHIPS: AdminLifecycleChipKey[] = [
  'all',
  'preparing',
  'ready_to_start',
  'in_production',
  'ready_to_ship',
  'shipped',
  'delivered',
];

/** Board tray order — Sales Order path only (RFQs live in Customer Requests desk). */
export const ADMIN_LIFECYCLE_SECTION_ORDER: Exclude<
  AdminOrderLifecycle,
  'rfq' | 'needs_attention'
>[] = [
  'preparing',
  'ready_to_start',
  'in_production',
  'ready_to_ship',
  'shipped',
  'delivered',
];

type Props = {
  value: AdminLifecycleChipKey;
  onChange: (value: AdminLifecycleChipKey) => void;
  counts?: Partial<Record<AdminLifecycleChipKey, number>>;
};

function stationTint(colors: ThemeColors, key: AdminLifecycleChipKey) {
  switch (key) {
    case 'ready_to_start':
      return { ink: colors.success, soft: colors.successSoft };
    case 'in_production':
      return { ink: colors.info, soft: colors.infoSoft };
    case 'ready_to_ship':
    case 'shipped':
      return { ink: colors.brand, soft: colors.brandSoft };
    case 'delivered':
      return { ink: colors.success, soft: colors.successSoft };
    case 'preparing':
    case 'all':
    default:
      return { ink: colors.brand, soft: colors.brandSoft };
  }
}

function stationIcon(key: AdminLifecycleChipKey): keyof typeof Ionicons.glyphMap {
  switch (key) {
    case 'all':
      return 'grid-outline';
    case 'preparing':
      return 'hourglass-outline';
    case 'ready_to_start':
      return 'play-circle-outline';
    case 'in_production':
      return 'hammer-outline';
    case 'ready_to_ship':
      return 'cube-outline';
    case 'shipped':
      return 'car-outline';
    case 'delivered':
      return 'checkmark-done-outline';
    default:
      return 'ellipse-outline';
  }
}

function shortLabel(key: AdminLifecycleChipKey, t: (k: string) => string): string {
  if (key === 'all') {
    const journey = t('mobile.orders.journey.all.label');
    if (journey !== 'mobile.orders.journey.all.label') return journey;
    const short = t('mobile.orders.lifecycleShort.all');
    return short === 'mobile.orders.lifecycleShort.all'
      ? t('mobile.orders.chips.all')
      : short;
  }
  return adminLifecycleHumanLabel(key, t);
}

function phaseHint(key: AdminLifecycleChipKey, t: (k: string) => string): string | null {
  if (key === 'all') {
    const hint = t('mobile.orders.journey.all.hint');
    return hint === 'mobile.orders.journey.all.hint' ? null : hint;
  }
  return adminLifecyclePhaseHint(key, t);
}

function StationCell({
  chip,
  count,
  focused,
  isRTL,
  locale,
  label,
  onPress,
  showConnector,
}: {
  chip: AdminLifecycleChipKey;
  count: number | null;
  focused: boolean;
  isRTL: boolean;
  locale: string;
  label: string;
  onPress: () => void;
  showConnector: boolean;
}) {
  const { colors, theme } = useTheme();
  const tint = stationTint(colors, chip);
  const scale = useSharedValue(focused ? 1 : 0.98);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.98, {
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayCount =
    chip === 'all'
      ? count != null
        ? String(count)
        : '·'
      : count != null && count > 0
        ? String(count)
        : '—';

  const quiet = chip !== 'all' && (count == null || count === 0) && !focused;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'stretch',
      }}
    >
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={count != null ? `${label} ${count}` : label}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{ zIndex: 2 }}
      >
        <Animated.View style={animStyle}>
          <View
            style={{
              width: 74,
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.sm,
              paddingHorizontal: theme.spacing.xs,
              borderRadius: theme.radius.lg,
              alignItems: 'center',
              gap: 6,
              backgroundColor: focused ? tint.soft : 'transparent',
              borderWidth: focused ? 1 : 0,
              borderColor: focused ? tint.ink : 'transparent',
              opacity: quiet ? 0.42 : 1,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? tint.ink : colors.surface,
                borderWidth: focused ? 0 : 1.5,
                borderColor: quiet ? colors.borderMuted : tint.ink,
              }}
            >
              <Ionicons
                name={stationIcon(chip)}
                size={14}
                color={focused ? colors.onBrand : tint.ink}
              />
            </View>

            <AppText
              variant="title"
              weight={locale === 'ar' ? 'medium' : 'semibold'}
              align="center"
              style={{
                color: focused ? tint.ink : colors.textPrimary,
                fontSize: 22,
                lineHeight: 26,
                letterSpacing: -0.4,
                fontVariant: ['tabular-nums'],
              }}
            >
              {displayCount}
            </AppText>

            <AppText
              variant="caption"
              align="center"
              numberOfLines={2}
              style={{
                color: focused ? tint.ink : colors.textMuted,
                fontSize: 10,
                lineHeight: 12,
                letterSpacing: locale === 'ar' ? 0 : 0.35,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                minHeight: 24,
                paddingHorizontal: 2,
              }}
            >
              {label}
            </AppText>
          </View>
        </Animated.View>
      </AnimatedPressable>

      {showConnector ? (
        <View
          pointerEvents="none"
          style={{
            width: 16,
            justifyContent: 'flex-start',
            paddingTop: theme.spacing.sm + 13,
          }}
        >
          <View
            style={{
              height: 1.5,
              backgroundColor: colors.borderStrong,
              opacity: 0.5,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Commercial lifecycle index — station board, not a chip strip.
 * Large counts, short labels, journey nodes. Maher parchment language.
 */
export function AdminLifecycleChips({ value, onChange, counts }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const chips = ADMIN_LIFECYCLE_CHIPS;

  const totalLive = useMemo(() => {
    return ADMIN_LIFECYCLE_SECTION_ORDER.reduce(
      (sum, key) => sum + (counts?.[key] ?? 0),
      0,
    );
  }, [counts]);

  useEffect(() => {
    const idx = Math.max(0, chips.indexOf(value));
    const approx = idx * 90;
    scrollRef.current?.scrollTo({ x: Math.max(0, approx - 48), animated: true });
  }, [value, chips, isRTL]);

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.sm,
        overflow: 'hidden',
        ...theme.elevation.rest,
      }}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.xs,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          style={{
            letterSpacing: locale === 'ar' ? 0 : 1.1,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 10,
            lineHeight: 12,
          }}
        >
          {t('mobile.orders.lifecycleIndex')}
        </AppText>
        <AppText
          variant="caption"
          color="secondary"
          style={{ fontSize: 11, lineHeight: 14, flex: 1, textAlign: isRTL ? 'left' : 'right' }}
        >
          {value === 'all'
            ? t('mobile.orders.lifecycleIndexAll', { count: totalLive })
            : phaseHint(value, t) ?? shortLabel(value, t)}
        </AppText>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
        }}
      >
        {chips.map((chip, index) => {
          const focused = value === chip;
          const count =
            chip === 'all' ? totalLive : counts?.[chip] != null ? counts[chip]! : null;
          const isLast = index === chips.length - 1;

          return (
            <StationCell
              key={chip}
              chip={chip}
              count={count}
              focused={focused}
              isRTL={isRTL}
              locale={locale}
              label={shortLabel(chip, t)}
              showConnector={!isLast}
              onPress={() => {
                // Tap active again → return to overview
                if (chip === value) {
                  onChange('all');
                  return;
                }
                onChange(chip);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
