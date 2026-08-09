import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme, type ThemeColors } from '@/theme';
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

function stageTint(colors: ThemeColors, key: OrdersStageKey) {
  switch (key) {
    case 'pending':
      return { tint: colors.brand, soft: colors.brandSoft };
    case 'production':
      return { tint: colors.info, soft: colors.infoSoft };
    case 'ready':
      return { tint: colors.success, soft: colors.successSoft };
  }
}

function StageIcon({
  stageKey,
  color,
  size,
}: {
  stageKey: OrdersStageKey;
  color: string;
  size: number;
}) {
  switch (stageKey) {
    case 'pending':
      return <Ionicons name="cube-outline" size={size} color={color} />;
    case 'production':
      return <MaterialCommunityIcons name="factory" size={size} color={color} />;
    case 'ready':
      return <Ionicons name="checkmark-circle-outline" size={size} color={color} />;
  }
}

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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.5,
        }}
      />

      <View
        style={{
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
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
          <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
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
              style={isRTL ? { fontSize: 11, lineHeight: 15 } : undefined}
            >
              {t('mobile.orders.pipelineHint')}
            </AppText>
          </View>
          {total > 0 ? (
            <View
              style={{
                minWidth: 28,
                height: 28,
                paddingHorizontal: 8,
                borderRadius: 14,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
              >
                {String(total)}
              </AppText>
            </View>
          ) : null}
        </View>

        <Animated.View
          style={[
            {
              height: 8,
              borderRadius: theme.radius.full,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
              flexDirection: isRTL ? 'row-reverse' : 'row',
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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          {STAGES.map((key) => {
            const { tint, soft } = stageTint(colors, key);
            const active = stageFocus === key;
            return (
              <StageNode
                key={key}
                stageKey={key}
                label={t(`mobile.orders.stages.${key}`)}
                value={counts[key]}
                tint={tint}
                soft={soft}
                active={active}
                onPress={() => {
                  void haptics.selection();
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
  onPress,
}: {
  stageKey: OrdersStageKey;
  label: string;
  value: number;
  tint: string;
  soft: string;
  active: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ flex: 1 }}>
      <AnimatedPressable
        variant="button"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${label} ${value}`}
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.sm,
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
              ...(isRTL ? { right: 0 } : { left: 0 }),
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
            backgroundColor: active ? colors.surface : colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: active ? tint : colors.border,
          }}
        >
          <StageIcon stageKey={stageKey} color={tint} size={15} />
        </View>
        <AppText
          variant="label"
          weight={titleWeight}
          dir="ltr"
          style={{ color: tint, fontVariant: ['tabular-nums'] }}
        >
          {String(value)}
        </AppText>
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={2}
          align="center"
          maxFontSizeMultiplier={1.1}
          style={{
            fontSize: isRTL ? 10 : 11,
            lineHeight: isRTL ? 13 : 14,
            textAlign: 'center',
          }}
        >
          {label}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}
