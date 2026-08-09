import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomePayload } from '../api';

type QueueKind = 'blocker' | 'watch' | 'flow';

type QueueRow = {
  key: string;
  kind: QueueKind;
  /** Sort weight — higher clears first */
  weight: number;
  count: number;
  titleKey: string;
  actionKey: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  data: AdminHomePayload;
};

function kindRank(kind: QueueKind): number {
  if (kind === 'blocker') return 3;
  if (kind === 'watch') return 2;
  return 1;
}

/**
 * Shift clearance board — featured next action + ranked queues + pressure + throughput.
 * Motion is entrance/emphasis only (no heavy perpetual loops).
 */
export function AdminHomeSignalMarquee({ data }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const queues = useMemo(() => {
    const rows: QueueRow[] = [
      {
        key: 'late',
        kind: 'blocker',
        weight: 100,
        count: data.delayedOrders,
        titleKey: 'mobile.adminHome.queue.late.title',
        actionKey: 'mobile.adminHome.queue.late.action',
        href: '/(app)/(admin)/(tabs)/orders',
        icon: 'time-outline',
      },
      {
        key: 'tasks',
        kind: 'blocker',
        weight: 90,
        count: data.urgentTasksCount,
        titleKey: 'mobile.adminHome.queue.tasks.title',
        actionKey: 'mobile.adminHome.queue.tasks.action',
        href: '/(app)/(admin)/(tabs)/production',
        icon: 'construct-outline',
      },
      {
        key: 'stock',
        kind: 'watch',
        weight: 70,
        count: data.lowStockItems,
        titleKey: 'mobile.adminHome.queue.stock.title',
        actionKey: 'mobile.adminHome.queue.stock.action',
        href: '/(app)/(admin)/(tabs)/inventory',
        icon: 'cube-outline',
      },
      {
        key: 'returns',
        kind: 'watch',
        weight: 60,
        count: data.pendingReturns,
        titleKey: 'mobile.adminHome.queue.returns.title',
        actionKey: 'mobile.adminHome.queue.returns.action',
        href: '/(app)/(admin)/(tabs)/orders',
        icon: 'return-down-back-outline',
      },
      {
        key: 'near',
        kind: 'flow',
        weight: 40,
        count: data.ordersNearingDelivery,
        titleKey: 'mobile.adminHome.queue.near.title',
        actionKey: 'mobile.adminHome.queue.near.action',
        href: '/(app)/(admin)/(tabs)/orders',
        icon: 'navigate-outline',
      },
    ];
    return [...rows].sort((a, b) => {
      const aLive = a.count > 0 ? 1 : 0;
      const bLive = b.count > 0 ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      const kr = kindRank(b.kind) - kindRank(a.kind);
      if (kr !== 0) return kr;
      if (b.count !== a.count) return b.count - a.count;
      return b.weight - a.weight;
    });
  }, [data]);

  const next = queues.find((q) => q.count > 0) ?? null;
  const rest = next ? queues.filter((q) => q.key !== next.key) : queues;
  const openCount = queues.filter((q) => q.count > 0).length;

  const wash = useSharedValue(reduce ? 0 : 1);

  useEffect(() => {
    if (reduce) {
      wash.value = 0;
      return;
    }
    wash.value = withDelay(120, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [reduce, wash]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: wash.value,
  }));

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(60).springify().damping(15) };

  const go = (href: Href) => {
    void haptics.confirmLight();
    router.push(href);
  };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.lg }}>
      <View style={{ gap: 4 }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
        >
          {t('mobile.adminHome.queueEyebrow')}
        </AppText>
        <AppText variant="title" weight="semibold">
          {t('mobile.adminHome.queueTitle')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {openCount === 0
            ? t('mobile.adminHome.queueAllClear')
            : t('mobile.adminHome.queueOpenSummary', { count: openCount })}
        </AppText>
      </View>

      {/* Featured next action */}
      {next ? (
        <FeaturedQueue
          row={next}
          reduce={reduce}
          washStyle={washStyle}
          onPress={() => go(next.href)}
        />
      ) : (
        <ClearBanner reduce={reduce} />
      )}

      {/* Ranked remainder */}
      <View style={{ gap: theme.spacing.sm }}>
        {rest.map((row, index) => (
          <RankedQueueRow
            key={row.key}
            row={row}
            rank={index + (next ? 2 : 1)}
            index={index}
            reduce={reduce}
            onPress={() => go(row.href)}
          />
        ))}
      </View>

      {/* Throughput */}
      <View style={{ gap: theme.spacing.xs }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ letterSpacing: 1.4, textTransform: 'uppercase', color: colors.textMuted }}
        >
          {t('mobile.adminHome.queueThroughput')}
        </AppText>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
          <ThroughputCell
            label={t('mobile.adminHome.metrics.completedToday')}
            value={data.completedToday}
            index={0}
            reduce={reduce}
            onPress={() => go('/(app)/(admin)/(tabs)/production')}
          />
          <ThroughputCell
            label={t('mobile.adminHome.metrics.ordersInProduction')}
            value={data.ordersInProduction}
            index={1}
            reduce={reduce}
            onPress={() => go('/(app)/(admin)/(tabs)/production')}
          />
          <ThroughputCell
            label={t('mobile.adminHome.metrics.newOrders')}
            value={data.newOrders}
            index={2}
            reduce={reduce}
            onPress={() => go('/(app)/(admin)/(tabs)/orders')}
          />
        </View>
      </View>
    </Wrapper>
  );
}

function FeaturedQueue({
  row,
  reduce,
  washStyle,
  onPress,
}: {
  row: QueueRow;
  reduce: boolean;
  washStyle: object;
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const stamp = useSharedValue(reduce ? 1 : 0);
  const nudge = useSharedValue(0);
  const hotPulse = useSharedValue(0);
  const isBlocker = row.kind === 'blocker';

  useEffect(() => {
    if (reduce) {
      stamp.value = 1;
      return;
    }
    stamp.value = withDelay(160, withSpring(1, { damping: 11, stiffness: 210 }));
    nudge.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    if (isBlocker) {
      hotPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
  }, [hotPulse, isBlocker, nudge, reduce, stamp]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [0.45, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-14, -3])}deg` },
    ],
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(nudge.value, [0, 1], [0, isRTL ? -5 : 5]) }],
  }));

  const pulseStyle = useAnimatedStyle(() =>
    isBlocker
      ? { opacity: 0.35 + hotPulse.value * 0.35 }
      : { opacity: 0 },
  );

  const ink = colorScheme === 'dark' ? colors.surfaceSecondary : '#2F2924';
  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(120).springify().damping(14) };

  return (
    <Shell {...shellProps}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${t('mobile.adminHome.queueNextUp')}. ${t(row.titleKey)} ${row.count}. ${t(row.actionKey)}`}
        onPress={onPress}
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: ink,
          padding: theme.spacing.lg,
          overflow: 'hidden',
          gap: theme.spacing.md,
          ...theme.elevation.raised,
        }}
      >
        {!reduce ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: colors.brandSoft,
                },
                washStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  ...(isRTL ? { left: -24 } : { right: -24 }),
                  top: -24,
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  borderWidth: 3,
                  borderColor: isBlocker ? colors.warning : colors.brand,
                },
                pulseStyle,
              ]}
            />
          </>
        ) : null}

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: isBlocker ? colors.warning : '#D4C4A8',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {t('mobile.adminHome.queueNextUp')}
          </AppText>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(245,241,234,0.12)',
            }}
          >
            <AppText variant="caption" weight="semibold" style={{ color: '#F5F1EA' }}>
              {t('mobile.adminHome.queuePriority', { n: 1 })}
            </AppText>
          </View>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <Animated.View style={stampStyle}>
            <CountUp
              value={row.count}
              variant="largeTitle"
              color={isBlocker ? '#E8C98A' : '#F5F1EA'}
            />
          </Animated.View>
          <View style={{ flex: 1, gap: 4 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name={row.icon} size={18} color="#D4C4A8" />
              <AppText variant="heading" weight="semibold" style={{ color: '#F5F1EA', flex: 1 }} numberOfLines={1}>
                {t(row.titleKey)}
              </AppText>
            </View>
            <AppText variant="bodySecondary" style={{ color: 'rgba(245,241,234,0.65)' }} numberOfLines={2}>
              {t(row.actionKey)}
            </AppText>
          </View>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: theme.spacing.xs,
            borderTopWidth: 1,
            borderTopColor: 'rgba(245,241,234,0.12)',
          }}
        >
          <AppText variant="label" weight="semibold" style={{ color: '#D4C4A8' }}>
            {t('mobile.adminHome.queueDoThis')}
          </AppText>
          <Animated.View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }, chevronStyle]}>
            <AppText variant="caption" weight="semibold" style={{ color: '#F5F1EA' }}>
              {t('mobile.adminHome.queueOpen')}
            </AppText>
            <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={16} color="#F5F1EA" />
          </Animated.View>
        </View>
      </AnimatedPressable>
    </Shell>
  );
}

function ClearBanner({ reduce }: { reduce: boolean }) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(120).springify().damping(15) };

  return (
    <Shell
      {...shellProps}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.successSoft,
        padding: theme.spacing.lg,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
      }}
    >
      <Ionicons name="checkmark-circle" size={28} color={colors.success} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="heading" weight="semibold">
          {t('mobile.adminHome.queueFloorClear')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.adminHome.queueAllClear')}
        </AppText>
      </View>
    </Shell>
  );
}

function RankedQueueRow({
  row,
  rank,
  index,
  reduce,
  onPress,
}: {
  row: QueueRow;
  rank: number;
  index: number;
  reduce: boolean;
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const enter = useSharedValue(reduce ? 1 : 0);
  const bar = useSharedValue(0);
  const clear = row.count === 0;
  const hot = row.kind === 'blocker' && row.count > 0;
  const watch = row.kind === 'watch' && row.count > 0;
  const tint = hot ? colors.warning : watch ? colors.brand : colors.textMuted;

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      bar.value = clear ? 0.08 : Math.min(1, 0.25 + row.count * 0.08);
      return;
    }
    enter.value = withDelay(
      200 + index * 90,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
    bar.value = withDelay(
      320 + index * 90,
      withTiming(clear ? 0.08 : Math.min(1, 0.28 + row.count * 0.09), {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [bar, clear, enter, index, reduce, row.count]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      {
        translateX: interpolate(enter.value, [0, 1], isRTL ? [-22, 0] : [22, 0]),
      },
    ],
  }));

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.04, bar.value) }],
  }));

  return (
    <Animated.View style={rowStyle}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${t('mobile.adminHome.queuePriority', { n: rank })}. ${t(row.titleKey)} ${row.count}`}
        onPress={onPress}
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: hot ? colors.warningSoft : colors.surface,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
          opacity: clear ? 0.7 : 1,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: colors.textMuted, minWidth: 22 }}
          >
            {String(rank).padStart(2, '0')}
          </AppText>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: clear ? colors.surfaceSecondary : hot ? colors.warningSoft : colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={row.icon} size={18} color={tint} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" weight="semibold" numberOfLines={1}>
              {t(row.titleKey)}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {clear ? t('mobile.adminHome.queueClear') : t(row.actionKey)}
            </AppText>
          </View>
          <CountUp value={row.count} variant="heading" color={clear ? colors.textMuted : tint} />
        </View>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.surfaceSecondary,
            overflow: 'hidden',
            marginStart: isRTL ? 0 : 58,
            marginEnd: isRTL ? 58 : 0,
          }}
        >
          <Animated.View
            style={[
              {
                height: 4,
                width: '100%',
                borderRadius: 2,
                backgroundColor: tint,
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
              },
              barStyle,
            ]}
          />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function ThroughputCell({
  label,
  value,
  index,
  reduce,
  onPress,
}: {
  label: string;
  value: number;
  index: number;
  reduce: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const Enter = isRTL ? FadeInRight : FadeInLeft;
  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: Enter.delay(280 + index * 80).springify().damping(16) };

  return (
    <Shell {...shellProps} style={{ flex: 1 }}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
        onPress={onPress}
        style={{
          gap: 4,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          alignItems: isRTL ? 'flex-end' : 'flex-start',
          minHeight: 78,
        }}
      >
        <CountUp value={value} variant="heading" color={colors.brand} />
        <AppText variant="caption" color="secondary" numberOfLines={2}>
          {label}
        </AppText>
      </AnimatedPressable>
    </Shell>
  );
}
