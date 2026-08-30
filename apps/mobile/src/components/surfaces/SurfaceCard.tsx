import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AnimatedPressable } from '@/motion';
import { useTheme } from '@/theme';

type SurfaceCardProps = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

/** Shared paper card with soft elevation so boards lift off the canvas. */
export function SurfaceCard({
  children,
  onPress,
  accessibilityLabel,
  style,
  padded = true,
}: SurfaceCardProps) {
  const { colors, theme } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.card,
    padding: padded ? theme.spacing.lg : 0,
    ...theme.elevation.card,
  };

  if (onPress) {
    return (
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={[cardStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
