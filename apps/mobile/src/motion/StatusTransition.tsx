import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { durations, easingBezier, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  /** Remount / change key to crossfade. */
  statusKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  durationMs?: number;
};

export function StatusTransition({
  statusKey,
  children,
  style,
  durationMs = durations.micro,
}: Props) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      opacity.value = 1;
      return;
    }
    const d = withMotionDuration(durationMs, reduce);
    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: d,
      easing: Easing.bezier(...easingBezier.standard),
    });
  }, [durationMs, opacity, reduce, statusKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
