import { type ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BrandCheckbox } from '@/components/sheets/BrandCheckbox';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { sheetChrome, useTheme } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  showCheckbox?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  destructive?: boolean;
  accessibilityLabel?: string;
};

/**
 * Cream bordered sheet row — Show on Home language (image 3).
 */
export function SheetRow({
  label,
  onPress,
  selected = false,
  showCheckbox = false,
  leading,
  trailing,
  destructive = false,
  accessibilityLabel,
}: Props) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL } = useLocale();
  const chrome = sheetChrome(colors, colorScheme);
  const ink = destructive ? colors.error : colors.textPrimary;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: chrome.rowBorder,
        backgroundColor: chrome.row,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
      }}
    >
      {showCheckbox ? <BrandCheckbox checked={selected} /> : null}
      {leading}
      <AppText
        variant="label"
        weight="medium"
        style={{ color: ink, flex: 1 }}
        align={isRTL ? 'end' : 'start'}
      >
        {label}
      </AppText>
      {trailing}
    </AnimatedPressable>
  );
}
