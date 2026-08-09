import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { UrgentAlert } from '../selectUrgentAlert';

type UrgentAlertCardProps = {
  alert: UrgentAlert;
};

/** Stamp notice — one-shot entrance (no perpetual pulse loops). */
export function UrgentAlertCard({ alert }: UrgentAlertCardProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const stamp = useSharedValue(reduce ? 1 : 0);
  const wipe = useSharedValue(reduce ? 1 : 0);

  const title = t(`mobile.adminHome.alert.${alert.kind}.title`);
  const body = t(`mobile.adminHome.alert.${alert.kind}.body`, { count: alert.count });

  const href =
    alert.kind === 'lowStock'
      ? ('/(app)/(admin)/(tabs)/inventory' as Href)
      : alert.kind === 'urgentTasks'
        ? ('/(app)/(admin)/(tabs)/production' as Href)
        : ('/(app)/(admin)/(tabs)/orders' as Href);

  useEffect(() => {
    if (reduce) {
      stamp.value = 1;
      wipe.value = 1;
      return;
    }
    wipe.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    stamp.value = withDelay(140, withSpring(1, { damping: 12, stiffness: 200 }));
  }, [reduce, stamp, wipe]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [0.55, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-8, -2])}deg` },
    ],
  }));

  const wipeStyle = useAnimatedStyle(() => ({
    opacity: wipe.value,
    transform: [
      {
        translateX: interpolate(wipe.value, [0, 1], isRTL ? [36, 0] : [-36, 0]),
      },
    ],
  }));

  const Enter = isRTL ? FadeInLeft : FadeInRight;
  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce ? {} : { entering: Enter.delay(60).springify().damping(15) };
  const ink = colorScheme === 'dark' ? colors.surface : '#2F2924';

  return (
    <Shell {...shellProps} style={{ marginBottom: theme.spacing.xl }}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        onPress={() => {
          void haptics.confirmLight();
          router.push(href);
        }}
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: ink,
          padding: theme.spacing.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.warning,
          ...theme.elevation.raised,
        }}
      >
        <Animated.View style={wipeStyle}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.warning,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: theme.spacing.sm,
            }}
          >
            {t('mobile.adminHome.alertEyebrow')}
          </AppText>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: theme.spacing.md,
            }}
          >
            <Animated.View style={stampStyle}>
              <CountUp value={alert.count} variant="largeTitle" color="#F5F1EA" />
            </Animated.View>
            <View style={{ flex: 1, gap: 4, paddingBottom: 4 }}>
              <AppText variant="heading" weight="semibold" style={{ color: '#F5F1EA' }}>
                {title}
              </AppText>
              <AppText variant="bodySecondary" style={{ color: 'rgba(245,241,234,0.65)' }}>
                {body}
              </AppText>
            </View>
          </View>
        </Animated.View>
      </AnimatedPressable>
    </Shell>
  );
}
