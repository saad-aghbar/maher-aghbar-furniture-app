import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '../theme/tokens';

export function ProgressBar({
  percent,
  tone = colors.brand,
  height = 8,
}: {
  percent: number;
  tone?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: reduceMotion ? 0 : 320 });
  }, [clamped, reduceMotion, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    backgroundColor: tone,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[styles.track, { height }]}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
