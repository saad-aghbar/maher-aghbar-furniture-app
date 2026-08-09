import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
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
  delayMs?: number;
  durationMs?: number;
};

export function FadeIn({
  children,
  style,
  delayMs = 0,
  durationMs = durations.cardEnter,
}: Props) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      opacity.value = 1;
      return;
    }
    const d = withMotionDuration(durationMs, reduce);
    opacity.value = withDelay(
      delayMs,
      withTiming(1, {
        duration: d,
        easing: Easing.bezier(...easingBezier.standard),
      }),
    );
  }, [delayMs, durationMs, opacity, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
