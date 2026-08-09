import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { error as hapticError } from './haptics';
import { durations, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  /** Change when validation fails to shake. */
  shakeKey: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
};

export function FormShake({ shakeKey, children, style, haptic = true }: Props) {
  const reduce = useReducedMotion();
  const tx = useSharedValue(0);

  useEffect(() => {
    if (shakeKey === 0 || shakeKey === '') return;
    if (haptic) void hapticError();
    if (reduce) {
      tx.value = 0;
      return;
    }
    const step = withMotionDuration(40, reduce);
    tx.value = withSequence(
      withTiming(-8, { duration: step }),
      withTiming(8, { duration: step }),
      withTiming(-6, { duration: step }),
      withTiming(6, { duration: step }),
      withTiming(0, { duration: withMotionDuration(durations.press, reduce) }),
    );
  }, [haptic, reduce, shakeKey, tx]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
