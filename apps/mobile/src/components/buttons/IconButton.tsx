import { type ReactNode } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { getIconButtonStyle } from './buttonStyles';

type IconButtonProps = {
  accessibilityLabel: string;
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  accessibilityLabel,
  children,
  onPress,
  disabled = false,
  style,
}: IconButtonProps) {
  const { theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={(e) => {
        void haptics.selection();
        onPress?.(e);
      }}
      style={[getIconButtonStyle(theme, disabled), style]}
    >
      {children}
    </AnimatedPressable>
  );
}
