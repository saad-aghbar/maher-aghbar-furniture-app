import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { DirectionalIcon } from '@/components/DirectionalIcon';
import {
  alignStart,
  extraStartPadding,
  localeRow,
  pinStart,
  useLocale,
} from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme, type ThemeColors } from '@/theme';
import { honestJourneyCount } from '../honestJourneyCount';
import {
  toggleStageFocus,
  type OrdersStageFocus,
  type OrdersStageKey,
} from '../stageCounts';
import { orderBoardShadow } from './orderFloorStyle';

type Props = {
  counts: Record<OrdersStageKey, number>;
  stageFocus: OrdersStageFocus;
  onStageFocusChange: (next: OrdersStageFocus) => void;
};

type JourneyKey = OrdersStageKey | 'all';

function stageTint(colors: ThemeColors, key: JourneyKey) {
  if (key === 'production') {
    return { tint: colors.brandActive, soft: colors.brandSoft };
  }
  return { tint: colors.brand, soft: colors.brandSoft };
}

function StageIcon({
  stageKey,
  color,
  size,
}: {
  stageKey: JourneyKey;
  color: string;
  size: number;
}) {
  switch (stageKey) {
    case 'all':
      return <Ionicons name="apps-outline" size={size} color={color} />;
    case 'pending':
      return <Ionicons name="hourglass-outline" size={size} color={color} />;
    case 'ready':
      return (
        <DirectionalIcon>
          <Ionicons name="play-outline" size={size} color={color} />
        </DirectionalIcon>
      );
    case 'production':
      return <MaterialCommunityIcons name="hammer" size={size} color={color} />;
  }
}

/** 4-up: All · Prep · Ready · Prod — one-line labels, honest zeros. */
const JOURNEY: JourneyKey[] = ['all', 'pending', 'ready', 'production'];
const STAGES: OrdersStageKey[] = ['pending', 'production', 'ready'];

/**
 * On-the-line stage spine — elevated floor board, tinted nodes, living mix rail.
 */
export function OrdersStageSpine({ counts, stageFocus, onStageFocusChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const rail = useSharedValue(reduce ? 1 : 0);
  const sheen = useSharedValue(0);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const total = useMemo(
    () => STAGES.reduce((sum, k) => sum + counts[k], 0),
    [counts],
  );

  useEffect(() => {
    if (reduce) {
      rail.value = 1;
      return;
    }
    rail.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    sheen.value = withDelay(
      320,
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
    );
  }, [rail, reduce, sheen]);

  const railStyle = useAnimatedStyle(() => ({ opacity: rail.value }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.35, 0.7, 1], [0, 0.16, 0.08, 0]),
    transform: [
      {
        translateX: interpolate(sheen.value, [0, 1], isRTL ? [120, -180] : [-120, 180]),
      },
    ],
  }));

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
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...pinStart(isRTL),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.5,
        }}
      />

      <View
        style={{
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...extraStartPadding(isRTL, theme.spacing.md + 4),
        }}
      >
        <View
          style={{
            flexDirection: localeRow(isRTL),
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: localeRow(isRTL),
              alignItems: 'center',
              gap: theme.spacing.sm,
              flex: 1,
              minWidth: 0,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceSecondary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="git-network-outline" size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 2, minWidth: 0, alignItems: alignStart(isRTL) }}>
              <AppText
                variant="caption"
                weight={titleWeight}
                style={{
                  color: colors.brand,
                  letterSpacing: locale === 'ar' ? 0 : 1.2,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                  lineHeight: 14,
                }}
              >
                {t('mobile.orders.pipelineEyebrow')}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                maxFontSizeMultiplier={1.15}
              >
                {t('mobile.orders.pipelineHint')}
              </AppText>
            </View>
          </View>
          <View
            style={{
              minWidth: 28,
              height: 28,
              paddingHorizontal: 8,
              borderRadius: 14,
              backgroundColor: total === 0 ? colors.background : colors.brandSoft,
              borderWidth: 1,
              borderColor: total === 0 ? colors.borderStrong : colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{
                color: total === 0 ? colors.textPrimary : colors.brand,
                fontVariant: ['tabular-nums'],
              }}
            >
              {honestJourneyCount(total)}
            </AppText>
          </View>
        </View>

        <Animated.View
          style={[
            {
              height: 8,
              borderRadius: theme.radius.full,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
              flexDirection: localeRow(isRTL),
              gap: 2,
              padding: 2,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            },
            railStyle,
          ]}
        >
          {STAGES.map((key) => {
            const value = counts[key];
            if (total === 0 || value <= 0) return null;
            const { tint } = stageTint(colors, key);
            return (
              <View
                key={key}
                style={{
                  flex: value,
                  minWidth: 6,
                  borderRadius: theme.radius.full,
                  backgroundColor: tint,
                }}
              />
            );
          })}
          {!reduce ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 36,
                  backgroundColor: colors.onBrand,
                },
                sheenStyle,
              ]}
            />
          ) : null}
        </Animated.View>

        <View
          style={{
            flexDirection: localeRow(isRTL),
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          {JOURNEY.map((key) => {
            const { tint, soft } = stageTint(colors, key);
            const active = stageFocus === key;
            const value = key === 'all' ? total : (counts[key] ?? 0);
            return (
              <StageNode
                key={key}
                stageKey={key}
                label={t(`mobile.orders.stages.${key}`)}
                value={value}
                tint={tint}
                soft={soft}
                active={active}
                empty={value === 0}
                onPress={() => {
                  void haptics.selection();
                  if (key === 'all') {
                    onStageFocusChange('all');
                    return;
                  }
                  onStageFocusChange(toggleStageFocus(stageFocus, key));
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function StageNode({
  stageKey,
  label,
  value,
  tint,
  soft,
  active,
  empty,
  onPress,
}: {
  stageKey: JourneyKey;
  label: string;
  value: number;
  tint: string;
  soft: string;
  active: boolean;
  empty?: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const selected = useSharedValue(active ? 1 : 0);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  useEffect(() => {
    if (reduce) {
      selected.value = active ? 1 : 0;
      return;
    }
    selected.value = withSpring(active ? 1 : 0, theme.motion.spring.snappy);
  }, [active, reduce, selected, theme.motion.spring.snappy]);

  const selectStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(selected.value, [0, 1], [1, 1.03]) }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, selectStyle]}>
      <AnimatedPressable
        variant="button"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${label} ${value}`}
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          backgroundColor: active ? soft : colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: active ? tint : colors.border,
          gap: 4,
          alignItems: 'center',
          overflow: 'hidden',
          minHeight: 76,
        }}
      >
        {active ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...pinStart(isRTL),
              width: 3,
              backgroundColor: tint,
              opacity: 0.9,
            }}
          />
        ) : null}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: empty ? colors.border : tint,
          }}
        >
          <StageIcon
            stageKey={stageKey}
            color={empty ? colors.textPrimary : tint}
            size={15}
          />
        </View>
        <AppText
          variant="label"
          weight={titleWeight}
          dir="ltr"
          style={{
            color: empty ? colors.textPrimary : tint,
            fontVariant: ['tabular-nums'],
          }}
        >
          {honestJourneyCount(value)}
        </AppText>
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={1}
          align="center"
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={1.1}
          style={{
            fontSize: 11,
            lineHeight: 14,
            width: '100%',
          }}
        >
          {label}
        </AppText>
      </AnimatedPressable>
    </Animated.View>
  );
}
