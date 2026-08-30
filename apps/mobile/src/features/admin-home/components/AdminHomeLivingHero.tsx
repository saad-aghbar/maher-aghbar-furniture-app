import { useEffect } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandMark } from '@/components/BrandMark';
import { AppText } from '@/components/AppText';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useLocale } from '@/i18n';
import { CountUp, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { useAtelierScrollY } from '../AtelierScrollContext';

type Props = {
  userName: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
  /** Merged floor load — only shown when `showAttention` is true */
  attention: number;
  onAttentionPress?: () => void;
  /** When false, hero stays quiet (Focus card owns the next step). Default true. */
  showAttention?: boolean;
};

function greetingPeriod(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Living Home hero — welcome, brand, chrome, one fused attention whisper.
 */
export function AdminHomeLivingHero({
  userName,
  unreadNotifications,
  canOpenNotifications,
  attention,
  onAttentionPress,
  showAttention = true,
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
  const stamp = useSharedValue(reduce ? 1 : 0);
  const whisper = useSharedValue(reduce ? 1 : 0);
  const bell = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      breathe.value = 0;
      stamp.value = 1;
      whisper.value = 1;
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 5600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    stamp.value = withDelay(
      40,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
    whisper.value = withDelay(
      280,
      withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
    );
    if (showAttention && attention > 0) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
    if (unreadNotifications > 0) {
      bell.value = withDelay(
        1100,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 110 }),
            withTiming(-1, { duration: 110 }),
            withTiming(0, { duration: 90 }),
            withTiming(0, { duration: 3000 }),
          ),
          -1,
          false,
        ),
      );
    }
  }, [attention, bell, breathe, pulse, reduce, showAttention, stamp, unreadNotifications, whisper]);

  const markStyle = useAnimatedStyle(() => {
    const scroll = scrollY.value;
    return {
      opacity: interpolate(breathe.value, [0, 1], [0.05, 0.12]),
      transform: [
        { translateY: interpolate(scroll, [0, 180], [0, 32]) },
        { scale: interpolate(breathe.value, [0, 1], [1, 1.05]) },
        { rotate: `${interpolate(breathe.value, [0, 1], [-7, -1])}deg` },
      ],
    };
  });

  const heroParallax = useAnimatedStyle(() => {
    const scroll = scrollY.value;
    return {
      transform: [{ translateY: interpolate(scroll, [0, 200], [0, -14]) }],
      opacity: interpolate(scroll, [0, 160], [1, 0.8]),
    };
  });

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [1.02, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-1.5, 0])}deg` },
    ],
  }));

  const whisperStyle = useAnimatedStyle(() => ({
    opacity: whisper.value,
    transform: [
      { translateY: interpolate(whisper.value, [0, 1], [4, 0]) },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: attention > 0 ? 0.25 + pulse.value * 0.4 : 0,
    transform: [{ scale: attention > 0 ? 1 + pulse.value * 0.06 : 1 }],
  }));

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bell.value * 12}deg` }],
  }));

  const ink = colorScheme === 'dark' ? colors.textPrimary : '#2A2420';
  // Date + EST. — Army Camo on parchment, Muted Silver on Liquorice (not iOS grey).
  const chromeSecondary = colorScheme === 'dark' ? colors.textSecondary : colors.brand;
  const markSize = Math.min(width * 0.48, 220);

  return (
    <Animated.View
      style={[
        {
          // Tight under welcome so search sits close to the tagline.
          marginBottom: theme.spacing.sm,
          marginHorizontal: -theme.spacing.lg,
        },
        heroParallax,
      ]}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              // RTL: keep the faded M inside the page (was hanging off the left and clipped).
              ...(isRTL ? { left: markSize * 0.02 } : { right: -markSize * 0.2 }),
              top: 8,
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
            flexDirection: isRTL ? 'row-reverse' : 'row',
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
              style={{ letterSpacing: 1.2, textTransform: 'uppercase', color: chromeSecondary }}
            >
              {formatDate(new Date())}
            </AppText>
          </Animated.View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
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
                  overflow: 'visible',
                }}
              >
                <Animated.View style={bellStyle}>
                  <Ionicons name="notifications-outline" size={20} color={colors.brand} />
                </Animated.View>
                {unreadNotifications > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 1,
                      ...(isRTL ? { left: 1 } : { right: 1 }),
                      minWidth: 20,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.warning,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 5,
                    }}
                  >
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{
                        color: colors.onBrand,
                        fontSize: 11,
                        lineHeight: 13,
                        includeFontPadding: false,
                      }}
                    >
                      {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>

        <View
          style={{
            zIndex: 2,
            gap: theme.spacing.sm,
            // Keep copy on the reading-start edge; maxWidth alone leaves a dead gutter in RTL.
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <Animated.View style={stampStyle}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: chromeSecondary,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              {t('mobile.adminHome.estLine')}
            </AppText>
          </Animated.View>

          <Animated.View entering={reduce ? undefined : softFadeDown(60)}>
            <AppText
              variant="largeTitle"
              style={{
                color: ink,
                fontSize: 40,
                lineHeight: 46,
                letterSpacing: -1.1,
                maxWidth: width * 0.82,
              }}
            >
              {t(`mobile.adminHome.greetingLead.${period}`)}
            </AppText>
          </Animated.View>

          <Animated.View entering={reduce ? undefined : softFadeDown(100)}>
            <AppText
              variant="largeTitle"
              numberOfLines={2}
              style={{
                color: ink,
                fontSize: 40,
                lineHeight: 46,
                letterSpacing: -1.1,
                maxWidth: width * 0.82,
              }}
            >
              {first}
            </AppText>
          </Animated.View>

          <Animated.View
            entering={reduce ? undefined : softFadeDown(140)}
            style={{ marginTop: theme.spacing.xs }}
          >
            <AppText
              variant="body"
              style={{
                color: colors.textSecondary,
                maxWidth: width * 0.72,
              }}
            >
              {t('mobile.adminHome.homeWelcome')}
            </AppText>
          </Animated.View>
        </View>

        {showAttention ? (
        <Animated.View style={[{ marginTop: theme.spacing.xl }, whisperStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              attention > 0
                ? `${attention} ${t('mobile.adminHome.homeWhisperOpen')}`
                : t('mobile.adminHome.homeWhisperClear')
            }
            onPress={() => {
              void haptics.selection();
              onAttentionPress?.();
            }}
            style={{
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: attention > 0 ? colors.warning : colors.border,
              backgroundColor: attention > 0 ? colors.warningSoft : colors.surface,
              overflow: 'hidden',
            }}
          >
            {attention > 0 && !reduce ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    backgroundColor: colors.warning,
                  },
                  pulseStyle,
                ]}
              />
            ) : null}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: attention > 0 ? colors.warning : colors.success,
              }}
            />
            {attention > 0 ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CountUp value={attention} variant="heading" color={colors.warning} />
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: colors.warning }}
                >
                  {t('mobile.adminHome.homeWhisperOpen')}
                </AppText>
              </View>
            ) : (
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: colors.textSecondary }}
              >
                {t('mobile.adminHome.homeWhisperClear')}
              </AppText>
            )}
          </Pressable>
        </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}
