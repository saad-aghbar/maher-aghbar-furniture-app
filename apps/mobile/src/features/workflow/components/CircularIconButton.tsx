import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'default' | 'brand' | 'danger';
  size?: number;
};

/** More-hub style circular icon control (notifications / places). */
export function CircularIconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'default',
  size = 40,
}: Props) {
  const { colors } = useTheme();
  const iconColor =
    tone === 'danger' ? colors.error : tone === 'brand' ? colors.brand : colors.brand;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={iconColor} />
    </AnimatedPressable>
  );
}

export function WorkflowPillButtonWrap({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <View style={{ borderRadius: theme.radius.xl, overflow: 'hidden' }}>{children}</View>;
}
