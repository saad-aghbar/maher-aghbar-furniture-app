import { useEffect } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
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
import { BrandMark } from '@/components/BrandMark';
import { AppText } from '@/components/AppText';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { CountUp, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { useAtelierScrollY } from '../AtelierScrollContext';

type Props = {
  userName: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
  attention: number;
};

function greetingPeriod(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Atelier hero — stamp + breath + rail. Kept lean so Expo Go doesn’t OOM.
 */
export function AdminHomeAtelierHero({
  userName,
  unreadNotifications,
  canOpenNotifications,
  attention,
}: Props) {
  const { t, formatDate, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const scrollY = useAtelierScrollY();
  const period = greetingPeriod(new Date().getHours());
  const first = userName.split(' ')[0] ?? userName;

  const breathe = useSharedValue(0);
  const rail = useSharedValue(0);
  const stamp = useSharedValue(reduce ? 1 : 0);
  const bell = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      breathe.value = 0;
      rail.value = attention > 0 ? 1 : 0.12;
      stamp.value = 1;
      return;
    }

    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    stamp.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 200, mass: 0.8 }));

    const target = attention <= 0 ? 0.14 : Math.min(1, 0.28 + attention * 0.07);
    rail.value = withDelay(400, withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) }));

    if (unreadNotifications > 0) {
      bell.value = withDelay(
        1200,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 120 }),
            withTiming(-1, { duration: 120 }),
            withTiming(0, { duration: 100 }),
            withTiming(0, { duration: 3200 }),
          ),
          -1,
          false,
        ),
      );
    }
  }, [attention, bell, breathe, rail, reduce, stamp, unreadNotifications]);

  const markStyle = useAnimatedStyle(() => {
    const scroll = scrollY.value;
    return {
      opacity: interpolate(breathe.value, [0, 1], [0.05, 0.11]),
      transform: [
        { translateY: interpolate(scroll, [0, 180], [0, 28]) },
        { scale: interpolate(breathe.value, [0, 1], [1, 1.04]) },
        { rotate: `${interpolate(breathe.value, [0, 1], [-6, -2])}deg` },
      ],
    };
  });

  const heroParallax = useAnimatedStyle(() => {
    const scroll = scrollY.value;
    return {
      transform: [{ translateY: interpolate(scroll, [0, 200], [0, -12]) }],
      opacity: interpolate(scroll, [0, 160], [1, 0.78]),
    };
  });

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [1.35, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-8, 0])}deg` },
    ],
  }));

  const railFill = useAnimatedStyle(() => ({
    width: Math.max(4, rail.value * (width - theme.spacing.lg * 2)),
  }));

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bell.value * 12}deg` }],
  }));

  const ink = colorScheme === 'dark' ? colors.textPrimary : '#2A2420';
  const markSize = Math.min(width * 0.42, 200);

  return (
    <Animated.View
      style={[{ marginBottom: theme.spacing.xl, marginHorizontal: -theme.spacing.lg }, heroParallax]}
    >
      <View
        style={{
          backgroundColor: colors.background,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.lg,
          overflow: 'hidden',
          minHeight: 220,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              ...(isRTL ? { left: markSize * 0.02 } : { right: -markSize * 0.15 }),
              top: 20,
              width: markSize,
              height: markSize,
            },
            markStyle,
          ]}
        >
          <BrandMark
            variant="monogram"
            size="hero"
            tone="auto"
            style={{ width: markSize, height: markSize }}
          />
        </Animated.View>

        <View
          style={{
            flexDirection: rowDirection(isRTL),
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 20,
            marginBottom: theme.spacing.lg,
          }}
        >
          <Animated.View entering={reduce ? undefined : FadeIn.duration(400)}>
            <AppText
              variant="caption"
              weight="medium"
              style={{ letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted }}
            >
              {formatDate(new Date())}
            </AppText>
          </Animated.View>
          <View
            style={{
              flexDirection: rowDirection(isRTL),
              gap: theme.spacing.xs,
              alignItems: 'center',
            }}
          >
            <ExpandableLocaleSwitcher expandToward="end" />
            <ThemeSwitcher />
            {canOpenNotifications ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mobile.adminHome.notificationsA11y')}
                onPress={() => {
                  void haptics.selection();
                  router.push('/(app)/notifications' as Href);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Animated.View style={bellStyle}>
                  <Ionicons name="notifications-outline" size={20} color={colors.brand} />
                </Animated.View>
                {unreadNotifications > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 4,
                      ...(isRTL ? { left: 4 } : { right: 4 }),
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: colors.warning,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 3,
                    }}
                  >
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{ color: colors.onBrand, fontSize: 9, lineHeight: 11 }}
                    >
                      {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ zIndex: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Animated.View style={stampStyle}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.brand,
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginBottom: theme.spacing.sm,
              }}
            >
              {t('mobile.adminHome.estLine')}
            </AppText>
          </Animated.View>

          <Animated.View entering={reduce ? undefined : FadeInDown.delay(180).springify().damping(15)}>
            <AppText
              variant="largeTitle"
              numberOfLines={3}
              style={{
                color: ink,
                fontSize: 36,
                lineHeight: 42,
                letterSpacing: -0.8,
                maxWidth: width * 0.8,
              }}
            >
              {t(`mobile.adminHome.greeting.${period}`, { name: first })}
            </AppText>
          </Animated.View>

          <Animated.View entering={reduce ? undefined : FadeInDown.delay(300).springify().damping(16)}>
            <AppText
              variant="body"
              style={{
                color: colors.textSecondary,
                marginTop: theme.spacing.sm,
                maxWidth: width * 0.74,
              }}
            >
              {t('mobile.adminHome.atelierSubtitle')}
            </AppText>
          </Animated.View>
        </View>

        <Animated.View
          entering={reduce ? undefined : FadeInDown.delay(420).springify().damping(16)}
          style={{ marginTop: theme.spacing.xl, gap: theme.spacing.xs }}
        >
          <View
            style={{
              flexDirection: rowDirection(isRTL),
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <AppText variant="caption" weight="medium" color="secondary">
              {t('mobile.adminHome.pulseEyebrow')}
            </AppText>
            <View style={{ flexDirection: rowDirection(isRTL), alignItems: 'baseline', gap: 6 }}>
              <CountUp value={attention} variant="title" color={colors.brand} />
              <AppText variant="caption" color="muted">
                {t('mobile.adminHome.pulseLabel')}
              </AppText>
            </View>
          </View>

          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={[
                {
                  height: 4,
                  backgroundColor: colors.brand,
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  borderRadius: 2,
                },
                railFill,
              ]}
            />
          </View>

          <AppText variant="caption" color="muted">
            {attention === 0 ? t('mobile.adminHome.pulseClear') : t('mobile.adminHome.pulseHint')}
          </AppText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
