import { type ComponentType, type ReactNode } from 'react';
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

type AnimatedPressableComponent = ComponentType<
  PressableProps & { style?: StyleProp<ViewStyle> }
>;

const AnimatedPressableBase = Animated.createAnimatedComponent(
  Pressable as never,
) as unknown as AnimatedPressableComponent;

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
  onHoverIn,
  onHoverOut,
  onFocus,
  onBlur,
  children,
  ...rest
}: Props) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const wash = useSharedValue(0);
  const target = variant === 'card' ? pressScale.card : pressScale.button;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - wash.value * 0.06,
  }));

  return (
    <AnimatedPressableBase
      {...rest}
      style={[style, animatedStyle]}
      onHoverIn={(e) => {
        if (!reduce) wash.value = withTiming(1, { duration: withMotionDuration(durations.press, reduce) });
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        wash.value = withTiming(0, { duration: withMotionDuration(durations.press, reduce) });
        onHoverOut?.(e);
      }}
      onFocus={(e) => {
        if (!reduce) wash.value = withTiming(1, { duration: withMotionDuration(durations.press, reduce) });
        onFocus?.(e);
      }}
      onBlur={(e) => {
        wash.value = withTiming(0, { duration: withMotionDuration(durations.press, reduce) });
        onBlur?.(e);
      }}
      onPressIn={(e) => {
        if (!reduce) {
          scale.value = withSpring(target, springs.press);
          wash.value = withTiming(1, { duration: withMotionDuration(durations.press, reduce) });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) {
          scale.value = withTiming(1, { duration: withMotionDuration(durations.press, reduce) });
        } else {
          scale.value = 1;
        }
        wash.value = withTiming(0, { duration: withMotionDuration(durations.press, reduce) });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
