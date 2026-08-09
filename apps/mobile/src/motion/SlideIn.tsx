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
import type { SlideDirection } from './types';
import { useReducedMotion } from './useReducedMotion';

const OFFSET = 6;

function offsets(direction: SlideDirection): { x: number; y: number } {
  switch (direction) {
    case 'up':
      return { x: 0, y: OFFSET };
    case 'down':
      return { x: 0, y: -OFFSET };
    case 'left':
      return { x: OFFSET, y: 0 };
    case 'right':
      return { x: -OFFSET, y: 0 };
  }
}

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  direction?: SlideDirection;
  delayMs?: number;
  durationMs?: number;
};

export function SlideIn({
  children,
  style,
  direction = 'up',
  delayMs = 0,
  durationMs = durations.cardEnter,
}: Props) {
  const reduce = useReducedMotion();
  const { x, y } = offsets(direction);
  const opacity = useSharedValue(reduce ? 1 : 0);
  const tx = useSharedValue(reduce ? 0 : x);
  const ty = useSharedValue(reduce ? 0 : y);

  useEffect(() => {
    if (reduce) {
      opacity.value = 1;
      tx.value = 0;
      ty.value = 0;
      return;
    }
    const d = withMotionDuration(durationMs, reduce);
    const timing = {
      duration: d,
      easing: Easing.bezier(...easingBezier.standard),
    };
    opacity.value = withDelay(delayMs, withTiming(1, timing));
    tx.value = withDelay(delayMs, withTiming(0, timing));
    ty.value = withDelay(delayMs, withTiming(0, timing));
  }, [delayMs, durationMs, opacity, reduce, tx, ty]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
