import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  label: string;
  value: string;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  onPress: () => void;
};

/** Pressable field that matches TextField height and floor styling. */
export function InventoryPickerRow({
  label,
  value,
  placeholder,
  icon = 'options-outline',
  accessibilityLabel,
  onPress,
}: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';
  const shown = value.trim();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          paddingHorizontal: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <Ionicons name={icon} size={18} color={colors.brand} />
        <AppText
          variant="body"
          weight={shown ? 'medium' : 'regular'}
          color={shown ? 'primary' : 'muted'}
          style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          numberOfLines={1}
        >
          {shown || placeholder || '—'}
        </AppText>
        <Ionicons name={chevron} size={16} color={colors.textMuted} />
      </AnimatedPressable>
    </View>
  );
}
