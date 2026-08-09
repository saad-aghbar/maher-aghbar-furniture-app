import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { ProgressBar } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  progressPercent: number;
  onPress?: () => void;
  height?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Progress bar that can open the workflow map without stealing the parent card press
 * when `onPress` is omitted (plain bar). When set, wraps in its own Pressable.
 */
export function WorkflowProgressHit({
  progressPercent,
  onPress,
  height = 6,
  children,
  style,
  accessibilityLabel,
}: Props) {
  const { theme } = useTheme();
  const bar = (
    <View style={[{ gap: theme.spacing.xs }, style]}>
      <ProgressBar progress={Math.max(0, Math.min(100, progressPercent)) / 100} height={height} />
      {children}
    </View>
  );

  if (!onPress) return bar;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={(e) => {
        // Prevent parent SurfaceCard / AnimatedPressable from also firing when nested.
        e.stopPropagation?.();
        onPress();
      }}
      hitSlop={6}
    >
      {bar}
    </Pressable>
  );
}
