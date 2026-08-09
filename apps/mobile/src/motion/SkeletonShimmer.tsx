import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { shimmerEnabled } from './reducedMotion';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Shimmer placeholder — static fill when reduced motion is on. */
export function SkeletonShimmer({ width = '100%', height = 16, style }: Props) {
  const reduce = useReducedMotion();
  const { colors, theme } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!shimmerEnabled(reduce)) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, reduce]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.45,
  }));

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: theme.radius.sm,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: colors.border,
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}
