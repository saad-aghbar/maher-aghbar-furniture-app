import { type ReactNode, useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { durations, easingBezier, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stagger index (multiplies delay). */
  index?: number;
  staggerMs?: number;
  durationMs?: number;
  /** When false, render immediately (e.g. inventory section tabs). */
  enabled?: boolean;
};

export function ListItemEnter({
  children,
  style,
  index = 0,
  staggerMs = 16,
  durationMs = durations.micro,
  enabled = true,
}: Props) {
  const reduce = useReducedMotion();
  const skip = !enabled || reduce;
  const opacity = useSharedValue(skip ? 1 : 0);
  const ty = useSharedValue(skip ? 0 : 3);
  const delayMs = index * staggerMs;

  useEffect(() => {
    if (skip) {
      opacity.value = 1;
      ty.value = 0;
      return;
    }
    const d = withMotionDuration(durationMs, reduce);
    const timing = {
      duration: d,
      easing: Easing.bezier(...easingBezier.standard),
    };
    opacity.value = withDelay(delayMs, withTiming(1, timing));
    ty.value = withDelay(delayMs, withTiming(0, timing));
  }, [delayMs, durationMs, opacity, reduce, skip, ty]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  if (!enabled) {
    return <View style={style}>{children}</View>;
  }

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
