import { type ReactNode, useEffect } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Motion is deliberately restrained: short, single-direction, and never
 * overshooting. Springs are critically damped so nothing wobbles, and
 * entrances move only a few pixels so lists never look like they are jumping.
 */
const PRESS_SPRING = { damping: 30, stiffness: 320, mass: 0.6, overshootClamping: true };
const ENTER_DURATION = 220;
const ENTER_EASING = Easing.out(Easing.cubic);
/** Entrances travel this far, in px. Small on purpose. */
const ENTER_OFFSET = 8;

/** Soft press feedback for tappable controls: a slight sink, no bounce. */
export function PressableScale({
  children,
  style,
  disabled,
  scaleTo = 0.98,
  ...props
}: PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, scaleTo]) }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.92]),
  }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        pressed.value = reduceMotion ? 1 : withSpring(1, PRESS_SPRING);
      }}
      onPressOut={() => {
        pressed.value = reduceMotion ? 0 : withSpring(0, PRESS_SPRING);
      }}
      {...props}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Mount entrance. Uses a plain timing curve rather than a layout animation so
 * it cannot overshoot and does not flicker when a parent list re-renders.
 */
export function FadeInView({
  children,
  delay = 0,
  style,
  from = 'down',
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  from?: 'down' | 'up' | 'zoom';
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: ENTER_DURATION, easing: ENTER_EASING }),
    );
  }, [delay, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const transform =
      from === 'zoom'
        ? [{ scale: interpolate(progress.value, [0, 1], [0.98, 1]) }]
        : [
            {
              translateY: interpolate(
                progress.value,
                [0, 1],
                [from === 'up' ? -ENTER_OFFSET : ENTER_OFFSET, 0],
              ),
            },
          ];
    return { opacity: progress.value, transform };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Very soft attention pulse for unread dots. Barely perceptible by design. */
export function Pulse({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.04]) }],
    opacity: interpolate(progress.value, [0, 1], [1, 0.85]),
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Stagger for small, fixed groups only (metric tiles, section cards).
 * Never use this for rows inside a scrolling list.
 */
export const staggerDelay = (index: number, step = 28, cap = 112) =>
  Math.min(Math.max(index, 0) * step, cap);
