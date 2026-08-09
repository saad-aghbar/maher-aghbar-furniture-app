import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { durations, easingBezier, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  /** 0 = fully open (sheet at rest), 1 = fully dismissed (off-screen). */
  progress: number;
  children: ReactNode;
  sheetHeight?: number;
  style?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  durationMs?: number;
  onBackdropPress?: () => void;
};

/**
 * Drivers for bottom sheet — translateY + backdrop.
 * `progress` 0 = visible, 1 = hidden below.
 */
export function BottomSheetTransition({
  progress,
  children,
  sheetHeight = 400,
  style,
  backdropStyle,
  durationMs = durations.sheet,
  onBackdropPress,
}: Props) {
  const reduce = useReducedMotion();
  const { colors } = useTheme();
  const p = useSharedValue(progress);

  useEffect(() => {
    const d = withMotionDuration(durationMs, reduce);
    if (reduce) {
      p.value = progress;
      return;
    }
    p.value = withTiming(progress, {
      duration: d,
      easing: Easing.bezier(...easingBezier.emphasized),
    });
  }, [durationMs, p, progress, reduce]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: p.value * sheetHeight }],
  }));

  const backdropAnim = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.55,
  }));

  return (
    <>
      <View
        style={StyleSheet.absoluteFillObject}
        // Capture pan/scroll so it cannot fall through a transparent Modal to the page.
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          pointerEvents={progress >= 1 ? 'none' : 'auto'}
          onPress={onBackdropPress}
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: colors.overlay },
            backdropAnim,
            backdropStyle,
          ]}
        />
      </View>
      <Animated.View style={[{ width: '100%' }, style, sheetStyle]}>{children}</Animated.View>
    </>
  );
}
