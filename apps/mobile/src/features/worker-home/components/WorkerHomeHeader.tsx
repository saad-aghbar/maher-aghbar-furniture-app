import { useEffect } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandMark } from '@/components/BrandMark';
import { AppText } from '@/components/AppText';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useLocale } from '@/i18n';
import { haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type WorkerHomeHeaderProps = {
  userName: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
};

function greetingPeriod(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Worker home top chrome — same rhythm as admin HomeHeader:
 * date + circular controls, then large greeting + faded M watermark.
 */
export function WorkerHomeHeader({
  userName,
  unreadNotifications,
  canOpenNotifications,
}: WorkerHomeHeaderProps) {
  const { t, formatDate, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const period = greetingPeriod(new Date().getHours());
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const markSize = Math.min(width * 0.46, 196);

  const breathe = useSharedValue(reduce ? 0.5 : 0);

  useEffect(() => {
    if (reduce) {
      breathe.value = 0.5;
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
  }, [breathe, reduce]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.05, 0.12]),
    transform: [
      { scale: interpolate(breathe.value, [0, 1], [1, 1.05]) },
      { rotate: `${interpolate(breathe.value, [0, 1], [-7, -1])}deg` },
    ],
  }));

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: softFadeDown(0) };

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        gap: theme.spacing.md,
        marginBottom: theme.spacing.md,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            // LTR: hang off the trailing edge; RTL: keep inside the leading edge.
            ...(isRTL ? { left: markSize * 0.12 } : { right: -markSize * 0.08 }),
            top: -markSize * 0.02,
            width: markSize,
            height: markSize,
            zIndex: 0,
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
          gap: theme.spacing.sm,
          zIndex: 30,
        }}
      >
        <AppText variant="caption" weight="medium" color="secondary" style={{ flex: 1 }}>
          {formatDate(new Date())}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <ExpandableLocaleSwitcher expandToward="end" />
          <ThemeSwitcher />
          {canOpenNotifications ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mobile.workerHome.notificationsA11y')}
              onPress={() => {
                void haptics.selection();
                router.push('/(app)/(employee)/(tabs)/notifications' as Href);
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
                ...theme.elevation.raised,
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.brand} />
              {unreadNotifications > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    ...(isRTL ? { left: 4 } : { right: 4 }),
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: colors.error,
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

      <View
        style={{
          gap: 2,
          zIndex: 2,
          width: '100%',
          // Full-width row so flex-end pins copy to the reading-start edge in RTL
          // (maxWidth on the box itself left a dead gutter on the right in Arabic).
          alignItems: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <AppText
          variant="largeTitle"
          numberOfLines={1}
          style={{ maxWidth: width * 0.72 }}
        >
          {t(`mobile.workerHome.greetingLead.${period}`)}
        </AppText>
        <AppText
          variant="largeTitle"
          numberOfLines={1}
          style={{ maxWidth: width * 0.72 }}
        >
          {firstName}
        </AppText>
        <AppText
          variant="bodySecondary"
          color="secondary"
          style={{ marginTop: theme.spacing.xs, maxWidth: width * 0.72 }}
        >
          {t('mobile.persona.production_worker')}
        </AppText>
      </View>
    </Wrapper>
  );
}
