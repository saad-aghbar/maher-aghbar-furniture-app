import { TextField } from '@/components/forms/TextField';
import { useTheme } from '@/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
};

/**
 * App Apple search (TextField + SearchBarShell). Only the icon and
 * placeholder are warmed — Liquorice / Tumbleweed — not a custom shape.
 */
export function OrdersSearchBar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();

  return (
    <TextField
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel ?? placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      clearButtonMode="while-editing"
      placeholderTextColor={colors.brandActive}
      iconColor={colors.textPrimary}
    />
  );
}
