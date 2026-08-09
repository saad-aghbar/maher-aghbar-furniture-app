import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { durations, springs, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';
import { completeStrong } from './haptics';

type Props = {
  /** Bump to replay. */
  triggerKey: string | number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
};

export function SuccessBurst({ triggerKey, children, style, haptic = true }: Props) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (haptic) void completeStrong();
    if (reduce) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    const half = withMotionDuration(durations.success / 2, reduce);
    scale.value = withSequence(
      withSpring(1.03, springs.success),
      withSpring(1, springs.gentle),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: half }),
      withTiming(1, { duration: half }),
    );
  }, [haptic, opacity, reduce, scale, triggerKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
