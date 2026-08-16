import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { durations, easingBezier, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  /** 0–1 */
  progress: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  trackStyle?: StyleProp<ViewStyle>;
  fillStyle?: StyleProp<ViewStyle>;
  durationMs?: number;
};

export function ProgressBar({
  progress,
  height = 6,
  style,
  trackStyle,
  fillStyle,
  durationMs = durations.micro,
}: Props) {
  const reduce = useReducedMotion();
  const { colors, theme } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const width = useSharedValue(0);

  useEffect(() => {
    const d = withMotionDuration(durationMs, reduce);
    if (reduce) {
      width.value = clamped;
      return;
    }
    width.value = withTiming(clamped, {
      duration: d,
      easing: Easing.bezier(...easingBezier.standard),
    });
  }, [clamped, durationMs, reduce, width]);

  const fillAnim = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      style={[
        {
          height,
          borderRadius: theme.radius.full,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
        },
        style,
        trackStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            backgroundColor: colors.brand,
            borderRadius: theme.radius.full,
          },
          fillAnim,
          fillStyle,
        ]}
      />
    </View>
  );
}
