import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { durations, easingBezier, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  left: number;
  width: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  durationMs?: number;
};

/** Animated underline / pill for tab bars. */
export function TabIndicator({
  left,
  width,
  height = 3,
  style,
  durationMs = durations.chip,
}: Props) {
  const reduce = useReducedMotion();
  const { colors, theme } = useTheme();
  const x = useSharedValue(left);
  const w = useSharedValue(width);

  useEffect(() => {
    const d = withMotionDuration(durationMs, reduce);
    if (reduce) {
      x.value = left;
      w.value = width;
      return;
    }
    const timing = {
      duration: d,
      easing: Easing.bezier(...easingBezier.emphasized),
    };
    x.value = withTiming(left, timing);
    w.value = withTiming(width, timing);
  }, [durationMs, left, reduce, w, width, x]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: w.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          height,
          borderRadius: theme.radius.full,
          backgroundColor: colors.brand,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
