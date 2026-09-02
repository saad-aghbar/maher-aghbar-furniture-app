import { type ComponentType, type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { durations, easingBezier, withMotionDuration } from './presets';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable as never) as unknown as ComponentType<
  PressableProps & { style?: StyleProp<ViewStyle> }
>;

/** Distance cap (px) — dismiss after this much downward travel, even on tall sheets. */
export const SHEET_DISMISS_DISTANCE_CAP = 120;
/** Fraction of sheet height that counts as a dismiss drag. */
export const SHEET_DISMISS_DISTANCE_RATIO = 0.25;
/** Downward flick (px/s) that dismisses even with a short drag. */
export const SHEET_DISMISS_VELOCITY = 900;

/**
 * Whether a handle pan should close the sheet.
 * Upward travel never dismisses.
 */
export function shouldDismissSheet(
  translationY: number,
  velocityY: number,
  sheetHeight: number,
): boolean {
  'worklet';
  if (translationY <= 0 || sheetHeight <= 0) return false;
  const distanceThreshold = Math.min(
    SHEET_DISMISS_DISTANCE_CAP,
    sheetHeight * SHEET_DISMISS_DISTANCE_RATIO,
  );
  return translationY > distanceThreshold || velocityY > SHEET_DISMISS_VELOCITY;
}

type Props = {
  /** 0 = fully open (sheet at rest), 1 = fully dismissed (off-screen). */
  progress: number;
  children: ReactNode;
  sheetHeight?: number;
  /** Live height while expandable sheets resize — preferred over `sheetHeight` when set. */
  sheetHeightSV?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  durationMs?: number;
  onBackdropPress?: () => void;
  /** Extra downward offset from the handle pan (px). */
  dragY?: SharedValue<number>;
  /** 1 while the handle pan is active — skips progress timing so the finger wins. */
  dragging?: SharedValue<number>;
};

/**
 * Drivers for bottom sheet — translateY + backdrop.
 * `progress` 0 = visible, 1 = hidden below.
 */
export function BottomSheetTransition({
  progress,
  children,
  sheetHeight = 400,
  sheetHeightSV,
  style,
  backdropStyle,
  durationMs = durations.sheet,
  onBackdropPress,
  dragY,
  dragging,
}: Props) {
  const reduce = useReducedMotion();
  const { colors } = useTheme();
  const p = useSharedValue(progress);
  const fallbackDragY = useSharedValue(0);
  const fallbackDragging = useSharedValue(0);
  const fallbackHeight = useSharedValue(sheetHeight);
  const offset = dragY ?? fallbackDragY;
  const isDragging = dragging ?? fallbackDragging;
  const heightSV = sheetHeightSV ?? fallbackHeight;

  useEffect(() => {
    if (!sheetHeightSV) {
      fallbackHeight.value = sheetHeight;
    }
  }, [fallbackHeight, sheetHeight, sheetHeightSV]);

  useEffect(() => {
    if (isDragging.value === 1) return;

    const h = heightSV.value > 0 ? heightSV.value : sheetHeight;
    const drag = Math.max(0, offset.value);
    if (progress >= 1 && drag > 0 && h > 0) {
      // Fold the finger offset into progress so close continues from here.
      p.value = Math.min(1, drag / h);
      offset.value = 0;
    }

    const d = withMotionDuration(durationMs, reduce);
    if (reduce) {
      p.value = progress;
      offset.value = 0;
      return;
    }
    p.value = withTiming(progress, {
      duration: d,
      easing: Easing.bezier(...easingBezier.emphasized),
    });
    // sheetHeight is read for dismiss-fold math only — omit from deps so resize
    // does not replay open/close motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [durationMs, heightSV, isDragging, offset, p, progress, reduce]);

  const sheetStyle = useAnimatedStyle(() => {
    const drag = Math.max(0, offset.value);
    const h = heightSV.value > 0 ? heightSV.value : sheetHeight;
    return {
      transform: [{ translateY: p.value * h + drag }],
    };
  });

  const backdropAnim = useAnimatedStyle(() => {
    const drag = Math.max(0, offset.value);
    const h = heightSV.value > 0 ? heightSV.value : sheetHeight;
    const combined = h > 0 ? p.value + drag / h : p.value;
    const clamped = Math.min(1, Math.max(0, combined));
    return {
      opacity: (1 - clamped) * 0.55,
    };
  });

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
