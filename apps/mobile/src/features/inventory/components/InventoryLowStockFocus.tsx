import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
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

type Props = {
  count: number;
  groupLabel: string;
  topSkuName?: string | null;
  onPress: () => void;
};

/**
 * One-shot low-stock focus moment — sheen + limited nudge; calm when count is 0 (hidden by parent).
 */
export function InventoryLowStockFocus({
  count,
  groupLabel,
  topSkuName,
  onPress,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const stamp = useSharedValue(reduce ? 1 : 0);
  const nudge = useSharedValue(0);
  const wash = useSharedValue(reduce ? 0 : 1);
  const sheen = useSharedValue(0);
  const rise = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      stamp.value = 1;
      wash.value = 0;
      rise.value = 1;
      return;
    }
    rise.value = withDelay(80, withSpring(1, { damping: 26, stiffness: 120 }));
    stamp.value = withDelay(180, withSpring(1, { damping: 24, stiffness: 130 }));
    wash.value = withDelay(80, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
    sheen.value = withDelay(
      420,
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
    );
    nudge.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        2,
        false,
      ),
    );
  }, [count, groupLabel, nudge, reduce, rise, sheen, stamp, wash]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [0.88, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [isRTL ? 4 : -4, 0])}deg` },
    ],
  }));

  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [
      { translateY: interpolate(rise.value, [0, 1], [14, 0]) },
      { scale: interpolate(rise.value, [0, 1], [0.98, 1]) },
    ],
  }));

  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.35, 0.7, 1], [0, 0.22, 0.12, 0]),
    transform: [
      {
        translateX: interpolate(sheen.value, [0, 1], isRTL ? [140, -200] : [-140, 200]),
      },
    ],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(nudge.value, [0, 1], [0, isRTL ? -8 : 8]) }],
  }));

  const ink = colorScheme === 'dark' ? colors.surfaceSecondary : '#2F2924';
  const amber = '#E8C98A';

  return (
    <View style={{ marginBottom: theme.spacing.sm }}>
      <Animated.View style={riseStyle}>
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.inventory.lowStockFocusA11y', {
            count,
            group: groupLabel,
          })}
          onPress={() => {
            void haptics.confirmLight();
            onPress();
          }}
          style={{
            borderRadius: theme.radius.xl,
            backgroundColor: ink,
            padding: theme.spacing.lg,
            overflow: 'hidden',
            gap: theme.spacing.md,
            borderWidth: 1,
            borderColor: 'rgba(232,201,138,0.28)',
            borderStartWidth: 4,
            borderStartColor: amber,
            ...theme.elevation.raised,
          }}
        >
          {!reduce ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(232,201,138,0.16)',
                },
                washStyle,
              ]}
            />
          ) : null}
          {!reduce ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: -40,
                  bottom: -40,
                  width: 56,
                  backgroundColor: '#F5F1EA',
                  transform: [{ rotate: '16deg' }],
                },
                sheenStyle,
              ]}
            />
          ) : null}

          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: amber,
              letterSpacing: 2,
              textTransform: 'uppercase',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {t('mobile.inventory.lowStockFocusEyebrow')}
          </AppText>

          <Animated.View style={[{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }, stampStyle]}>
            <CountUp value={count} variant="largeTitle" color="#F5F1EA" />
          </Animated.View>

          <View style={{ gap: 6 }}>
            <AppText
              variant="heading"
              weight={locale === 'ar' ? 'medium' : 'semibold'}
              style={{ color: '#F5F1EA', writingDirection: isRTL ? 'rtl' : 'ltr' }}
            >
              {t('mobile.inventory.lowStockFocusTitle', { group: groupLabel })}
            </AppText>
            <AppText
              variant="bodySecondary"
              style={{
                color: 'rgba(245,241,234,0.65)',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {topSkuName
                ? t('mobile.inventory.lowStockFocusBodySku', { name: topSkuName })
                : t('mobile.inventory.lowStockFocusBody')}
            </AppText>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderTopColor: 'rgba(245,241,234,0.12)',
              paddingTop: theme.spacing.md,
              gap: theme.spacing.md,
            }}
          >
            <AppText
              variant="label"
              weight="semibold"
              style={{ color: '#D4C4A8', flexShrink: 1 }}
            >
              {t('mobile.inventory.lowStockFocusCta')}
            </AppText>
            <Animated.View
              style={[
                {
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                },
                chevronStyle,
              ]}
            >
              <AppText variant="caption" weight="semibold" style={{ color: '#F5F1EA' }}>
                {t('mobile.inventory.lowStockFocusOpen')}
              </AppText>
              <Ionicons
                name={isRTL ? 'arrow-back' : 'arrow-forward'}
                size={16}
                color="#F5F1EA"
              />
            </Animated.View>
          </View>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}
