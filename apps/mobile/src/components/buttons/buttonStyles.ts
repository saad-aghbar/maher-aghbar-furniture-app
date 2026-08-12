import type { TextStyle, ViewStyle } from 'react-native';
import type { Theme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'success';

export function getButtonContainerStyle(
  theme: Theme,
  variant: ButtonVariant,
  disabled: boolean,
): ViewStyle {
  const { colors, spacing, radius, sizes } = theme;
  const base: ViewStyle = {
    minHeight: sizes.touch.min,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  };

  if (disabled) {
    return {
      ...base,
      backgroundColor: colors.disabledFill,
      borderWidth: variant === 'secondary' ? 1 : 0,
      borderColor: colors.border,
      opacity: 1,
    };
  }

  switch (variant) {
    case 'primary':
      return { ...base, backgroundColor: colors.brand };
    case 'secondary':
      return {
        ...base,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderStrong,
      };
    case 'tertiary':
      return { ...base, backgroundColor: 'transparent', paddingHorizontal: spacing.md };
    case 'destructive':
      return { ...base, backgroundColor: colors.error };
    case 'success':
      return { ...base, backgroundColor: colors.success };
    default:
      return base;
  }
}

export function getButtonLabelColor(
  theme: Theme,
  variant: ButtonVariant,
  disabled: boolean,
): string {
  const { colors } = theme;
  if (disabled) return colors.disabled;
  switch (variant) {
    case 'primary':
    case 'destructive':
    case 'success':
      return colors.onBrand;
    case 'secondary':
    case 'tertiary':
      return colors.brand;
    default:
      return colors.textPrimary;
  }
}

export function getButtonLabelStyle(
  theme: Theme,
  variant: ButtonVariant,
  disabled: boolean,
): TextStyle {
  return {
    color: getButtonLabelColor(theme, variant, disabled),
    fontSize: theme.typography.variants.label.fontSize,
    lineHeight: theme.typography.variants.label.lineHeight,
  };
}

export function getIconButtonStyle(theme: Theme, disabled: boolean): ViewStyle {
  const size = theme.sizes.touch.min;
  return {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: disabled ? theme.colors.disabledFill : 'transparent',
    opacity: disabled ? 0.7 : 1,
  };
}
