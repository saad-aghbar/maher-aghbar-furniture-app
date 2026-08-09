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
  expanded: boolean;
  children: ReactNode;
  /** Measured or estimated content height when expanded. */
  expandedHeight: number;
  style?: StyleProp<ViewStyle>;
  durationMs?: number;
};

/**
 * Animates container height between 0 and `expandedHeight`.
 * Prefer measuring content in the parent when possible.
 */
export function ExpandCollapse({
  expanded,
  children,
  expandedHeight,
  style,
  durationMs = durations.micro,
}: Props) {
  const reduce = useReducedMotion();
  const height = useSharedValue(expanded ? expandedHeight : 0);
  const opacity = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    const d = withMotionDuration(durationMs, reduce);
    if (reduce) {
      height.value = expanded ? expandedHeight : 0;
      opacity.value = expanded ? 1 : 0;
      return;
    }
    height.value = withTiming(expanded ? expandedHeight : 0, {
      duration: d,
      easing: Easing.bezier(...easingBezier.standard),
    });
    opacity.value = withTiming(expanded ? 1 : 0, {
      duration: d,
      easing: Easing.bezier(...easingBezier.standard),
    });
  }, [expanded, expandedHeight, durationMs, height, opacity, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: 'hidden' as const,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
