import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  /** Border / fill for the chrome circle */
  borderColor?: string;
  backgroundColor?: string;
  glowColor?: string;
  iconColor?: string;
  size?: number;
};

const DEFAULT_SIZE = 40;
const ICON = 22;
const SPIN_MS = 560;
const SETTLE_MS = 560;
const MORPH_MIN_SCALE = 0.55;

const morphTiming = {
  duration: 420,
  easing: Easing.inOut(Easing.cubic),
};

/**
 * Shared sun ↔ moon theme toggle (login + admin home).
 * Same Ionicons size for both glyphs so optical weight stays balanced.
 */
export function ThemeSwitcher({
  borderColor,
  backgroundColor,
  glowColor,
  iconColor,
  size = DEFAULT_SIZE,
}: Props = {}) {
  const { colorScheme, setMode, colors, theme } = useTheme();
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const isDark = colorScheme === 'dark';

  const modeProgress = useSharedValue(isDark ? 1 : 0);
  const spin = useSharedValue(0);
  const glow = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      modeProgress.value = isDark ? 1 : 0;
      return;
    }
    modeProgress.value = withTiming(isDark ? 1 : 0, morphTiming);
  }, [isDark, modeProgress, reduce]);

  const runToggleAnimation = useCallback(() => {
    if (reduce) return;
    spin.value = 0;
    spin.value = withTiming(1, {
      duration: SPIN_MS,
      easing: Easing.bezier(0.34, 1.2, 0.64, 1),
    });
    glow.value = 0;
    glow.value = withSequence(
      withTiming(1, { duration: SETTLE_MS * 0.45, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: SETTLE_MS * 0.55, easing: Easing.in(Easing.cubic) }),
    );
  }, [glow, reduce, spin]);

  const onPress = () => {
    void haptics.selection();
    runToggleAnimation();
    setMode(isDark ? 'light' : 'dark');
  };

  const iconWrapStyle = useAnimatedStyle(() => {
    const rot = interpolate(spin.value, [0, 0.4, 1], [0, 140, 360]);
    const scale = interpolate(spin.value, [0, 0.4, 1], [1, 0.88, 1]);
    return {
      transform: [{ rotate: `${rot}deg` }, { scale: scale * press.value }],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.85]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.7, 1.2]) }],
  }));

  const sunStyle = useAnimatedStyle(() => {
    const p = modeProgress.value;
    return {
      opacity: 1 - p,
      transform: [
        { scale: interpolate(p, [0, 1], [1, MORPH_MIN_SCALE]) },
        { rotate: `${p * 90}deg` },
      ],
    };
  });

  const moonStyle = useAnimatedStyle(() => {
    const p = modeProgress.value;
    return {
      opacity: p,
      transform: [
        { scale: interpolate(p, [0, 1], [MORPH_MIN_SCALE, 1]) },
        { rotate: `${-90 + p * 90}deg` },
      ],
    };
  });

  /** Match language circle + notification chrome (surface + brand ink). */
  const fillColor = iconColor ?? colors.brand;
  const chromeBorder = borderColor ?? colors.border;
  const chromeBg = backgroundColor ?? colors.surface;
  const softGlow = glowColor ?? colors.brandSoft;

  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(280).delay(40)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isDark ? t('navigation.themeToLight') : t('navigation.themeToDark')}
        hitSlop={6}
        onPressIn={() => {
          press.value = withTiming(0.96, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withTiming(1, { duration: 140 });
        }}
        onPress={onPress}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: chromeBorder,
          backgroundColor: chromeBg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          ...theme.elevation.raised,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: size / 2,
              backgroundColor: softGlow,
            },
            glowStyle,
          ]}
        />
        <Animated.View style={iconWrapStyle}>
          <View style={styles.iconBox}>
            <Animated.View style={[styles.iconLayer, sunStyle]}>
              <Ionicons name="sunny" size={ICON} color={fillColor} />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, moonStyle]}>
              <Ionicons name="moon" size={ICON} color={fillColor} />
            </Animated.View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    width: ICON,
    height: ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
