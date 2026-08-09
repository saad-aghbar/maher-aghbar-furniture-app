import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import {
  filterAdminOverflowModules,
  type AdminOverflowModule,
} from '../adminOverflowModules';

/**
 * Cinematic atlas — quick access to everything the tab bar doesn’t cover.
 */
export function AdminHomeQuickAccess() {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const pad = theme.spacing.lg;
  const gap = theme.spacing.sm;
  const halfW = (width - pad * 2 - gap) / 2;
  const ink = colorScheme === 'dark' ? colors.surfaceSecondary : '#2F2924';

  const visible = filterAdminOverflowModules(user, 'home');

  if (visible.length === 0) return null;

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(220).duration(400).damping(22) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View style={{ gap: 4 }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
        >
          {t('mobile.adminHome.navEyebrow')}
        </AppText>
        <AppText variant="title" weight="semibold">
          {t('mobile.adminHome.navTitle')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.adminHome.navHint')}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap,
        }}
      >
        {visible.map((mod, index) => (
          <ModuleTile
            key={mod.key}
            mod={mod}
            index={index}
            width={mod.span === 'full' ? width - pad * 2 : halfW}
            reduce={Boolean(reduce)}
            ink={ink}
            onPress={() => {
              void haptics.confirmLight();
              router.push(mod.href);
            }}
          />
        ))}
      </View>
    </Wrapper>
  );
}

function ModuleTile({
  mod,
  index,
  width,
  reduce,
  ink,
  onPress,
}: {
  mod: AdminOverflowModule;
  index: number;
  width: number;
  reduce: boolean;
  ink: string;
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const enter = useSharedValue(reduce ? 1 : 0);
  const iconTilt = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(240 + index * 90, withSpring(1, { damping: 24, stiffness: 130 }));
    iconTilt.value = withDelay(
      360 + index * 90,
      withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
    if (index === 0) {
      sheen.value = withDelay(
        520,
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }),
      );
    }
  }, [enter, iconTilt, index, reduce, sheen]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [12, 0]) },
      { scale: interpolate(enter.value, [0, 1], [0.96, 1]) },
      {
        rotate: `${interpolate(enter.value, [0, 1], [isRTL ? 1 : -1, 0])}deg`,
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(iconTilt.value, [0, 1], [-16, 0])}deg` }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.4, 1], [0, 0.2, 0]),
    transform: [
      {
        translateX: interpolate(sheen.value, [0, 1], isRTL ? [100, -140] : [-100, 140]),
      },
    ],
  }));

  const dark = mod.tone === 'ink';
  const bg = dark ? ink : colors.surface;
  const fg = dark ? '#F5F1EA' : colors.textPrimary;
  const muted = dark ? 'rgba(245,241,234,0.62)' : colors.textSecondary;
  const iconTint = dark ? '#D4C4A8' : colors.brand;

  return (
    <Animated.View style={[{ width }, style]}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={t(mod.labelKey)}
        onPress={onPress}
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: bg,
          borderWidth: dark ? 0 : 1,
          borderColor: colors.border,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md + 2,
          paddingBottom: theme.spacing.md + 2,
          justifyContent: 'flex-start',
          gap: theme.spacing.md,
          overflow: 'hidden',
          ...theme.elevation.raised,
        }}
      >
        {!reduce && index === 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: -24,
                bottom: -24,
                width: 44,
                backgroundColor: '#F5F1EA',
                transform: [{ rotate: '18deg' }],
              },
              sheenStyle,
            ]}
          />
        ) : null}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Animated.View
            style={[
              {
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: dark ? 'rgba(255,255,255,0.08)' : colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              },
              iconStyle,
            ]}
          >
            <Ionicons name={mod.icon} size={20} color={iconTint} />
          </Animated.View>
          <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={muted} />
        </View>
        <View style={{ gap: 4 }}>
          <AppText variant="heading" weight="semibold" style={{ color: fg }} numberOfLines={1}>
            {t(mod.labelKey)}
          </AppText>
          <AppText
            variant="caption"
            style={{ color: muted, fontSize: 10, lineHeight: 14, opacity: 0.9 }}
            numberOfLines={2}
            maxFontSizeMultiplier={1.15}
          >
            {t(mod.hintKey)}
          </AppText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
