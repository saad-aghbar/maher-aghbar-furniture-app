import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { durations, pressScale, springs, withMotionDuration } from './presets';
import type { PressVariant } from './types';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  variant?: PressVariant;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Press feedback via scale. Button: 0.97 · Card: 0.985.
 * Reduced motion: no scale change.
 */
export function AnimatedPressable({
  variant = 'button',
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const target = variant === 'card' ? pressScale.card : pressScale.button;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        if (!reduce) {
          scale.value = withSpring(target, springs.press);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) {
          scale.value = withTiming(1, { duration: withMotionDuration(durations.press, reduce) });
        } else {
          scale.value = 1;
        }
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
