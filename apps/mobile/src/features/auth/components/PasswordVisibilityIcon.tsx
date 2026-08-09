import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/motion';

type Props = {
  open: boolean;
  color: string;
  size?: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const morph = {
  duration: 340,
  easing: Easing.bezier(0.34, 1.12, 0.64, 1),
};

/** Tiny closed-eye lashes — top and bottom (really short ticks). */
const TOP_LASHES = [
  { x1: 7.2, y1: 10.55, x2: 6.85, y2: 9.35 },
  { x1: 12, y1: 10.2, x2: 12, y2: 8.85 },
  { x1: 16.8, y1: 10.55, x2: 17.15, y2: 9.35 },
] as const;

const BOTTOM_LASHES = [
  { x1: 7.2, y1: 13.45, x2: 6.85, y2: 14.65 },
  { x1: 12, y1: 13.8, x2: 12, y2: 15.15 },
  { x1: 16.8, y1: 13.45, x2: 17.15, y2: 14.65 },
] as const;

/**
 * Open eye when password is visible; lids close when hidden.
 * Closed state shows tiny top/bottom lashes that fade away when open.
 */
export function PasswordVisibilityIcon({ open, color, size = 22 }: Props) {
  const reduce = useReducedMotion();
  /** 0 = closed, 1 = open */
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      progress.value = open ? 1 : 0;
      return;
    }
    progress.value = withTiming(open ? 1 : 0, morph);
  }, [open, progress, reduce]);

  const upperLidProps = useAnimatedProps(() => {
    const y = interpolate(progress.value, [0, 1], [12, 6.2]);
    const ctrl = interpolate(progress.value, [0, 1], [12, 3.4]);
    return { d: `M3.2 ${y} Q12 ${ctrl} 20.8 ${y}` };
  });

  const lowerLidProps = useAnimatedProps(() => {
    const y = interpolate(progress.value, [0, 1], [12, 17.8]);
    const ctrl = interpolate(progress.value, [0, 1], [12, 20.6]);
    return { d: `M3.2 ${y} Q12 ${ctrl} 20.8 ${y}` };
  });

  const pupilProps = useAnimatedProps(() => ({
    opacity: progress.value,
    r: interpolate(progress.value, [0, 1], [0.15, 2.55]),
  }));

  const irisProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0.35, 1]),
    r: interpolate(progress.value, [0, 1], [0.4, 4.1]),
  }));

  const outlineProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.15, 0.35]),
  }));

  const lashesProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0, 0.45, 1], [1, 0.25, 0]),
  }));

  return (
    <View accessible={false} importantForAccessibility="no">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <AnimatedPath
          animatedProps={outlineProps}
          d="M2.4 12s3.7-6.6 9.6-6.6S21.6 12 21.6 12 17.9 18.6 12 18.6 2.4 12 2.4 12Z"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <AnimatedCircle
          animatedProps={irisProps}
          cx={12}
          cy={12}
          fill="none"
          stroke={color}
          strokeWidth={1.55}
        />
        <AnimatedCircle animatedProps={pupilProps} cx={12} cy={12} fill={color} />
        <AnimatedPath
          animatedProps={lowerLidProps}
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          animatedProps={upperLidProps}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedG animatedProps={lashesProps}>
          {TOP_LASHES.map((l, i) => (
            <Line
              key={`t-${i}`}
              {...l}
              stroke={color}
              strokeWidth={1.15}
              strokeLinecap="round"
            />
          ))}
          {BOTTOM_LASHES.map((l, i) => (
            <Line
              key={`b-${i}`}
              {...l}
              stroke={color}
              strokeWidth={1.15}
              strokeLinecap="round"
            />
          ))}
        </AnimatedG>
      </Svg>
    </View>
  );
}
