import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
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
import type { HomeFocus } from '../pickHomeFocus';

type Props = {
  focus: HomeFocus | null;
};

/**
 * One cinematic focus moment — stacked layout so Arabic/RTL never fights the number.
 */
export function AdminHomeFocusMoment({ focus }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
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
    // One soft sheen on enter — no perpetual loop (keeps Home calm).
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
  }, [nudge, reduce, rise, sheen, stamp, wash]);

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

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(140).duration(400).damping(22) };

  if (!focus) {
    return (
      <Shell
        {...shellProps}
        style={{
          marginBottom: theme.spacing.xl,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: theme.spacing.lg,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          ...theme.elevation.raised,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.successSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.success }}
          >
            {t('mobile.adminHome.homeFocusEyebrow')}
          </AppText>
          <AppText variant="heading" weight="semibold">
            {t('mobile.adminHome.homeFocusClear')}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t('mobile.adminHome.homeFocusClearBody')}
          </AppText>
        </View>
      </Shell>
    );
  }

  const ink = colorScheme === 'dark' ? colors.surfaceSecondary : '#2F2924';
  const hot = focus.kind === 'blocker';

  return (
    <Shell {...shellProps} style={{ marginBottom: theme.spacing.xl }}>
      <Animated.View style={riseStyle}>
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={`${t(focus.titleKey)} ${focus.count}`}
          onPress={() => {
            void haptics.confirmLight();
            router.push(focus.href);
          }}
          style={{
            borderRadius: theme.radius.xl,
            backgroundColor: ink,
            padding: theme.spacing.lg,
            overflow: 'hidden',
            gap: theme.spacing.md,
            borderWidth: 1,
            borderColor: hot ? 'rgba(232,201,138,0.28)' : 'rgba(212,196,168,0.18)',
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
                  backgroundColor: hot ? 'rgba(232,201,138,0.16)' : colors.brandSoft,
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
              color: hot ? '#E8C98A' : '#D4C4A8',
              letterSpacing: 2,
              textTransform: 'uppercase',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {t('mobile.adminHome.homeFocusEyebrow')}
          </AppText>

          <Animated.View style={[{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }, stampStyle]}>
            <CountUp value={focus.count} variant="largeTitle" color="#F5F1EA" />
          </Animated.View>

          <View style={{ gap: 6 }}>
            <AppText
              variant="heading"
              weight="semibold"
              style={{ color: '#F5F1EA', writingDirection: isRTL ? 'rtl' : 'ltr' }}
            >
              {t(focus.titleKey)}
            </AppText>
            <AppText
              variant="bodySecondary"
              style={{
                color: 'rgba(245,241,234,0.65)',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {t(focus.actionKey)}
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
              {t('mobile.adminHome.homeFocusCta')}
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
                {t('mobile.adminHome.queueOpen')}
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
    </Shell>
  );
}
