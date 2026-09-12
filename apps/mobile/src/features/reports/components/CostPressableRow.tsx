import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  accessibilityLabel: string;
  testID?: string;
  onPress: () => void;
  children: ReactNode;
};

/** Pressable inset row — every Cost & Performance list row must go somewhere. */
export function CostPressableRow({ accessibilityLabel, testID, onPress, children }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>{children}</View>
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={16}
        color={colors.textMuted}
      />
    </AnimatedPressable>
  );
}
