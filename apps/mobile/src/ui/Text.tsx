import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useI18n } from '../providers/i18n-provider';
import { colors, typography } from '../theme/tokens';

type Variant = keyof typeof typography;
type Color = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'inverse' | 'error' | 'success';

const colorMap: Record<Color, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  brand: colors.brand,
  inverse: '#FFFFFF',
  error: colors.error,
  success: colors.success,
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  color?: Color;
  /** Opt out of RTL alignment for numeric/latin values such as SKUs. */
  latin?: boolean;
};

/**
 * Text primitive that applies typography tokens and mirrors alignment for RTL.
 * Numbers and codes stay left-to-right via `latin`.
 */
export function Text({
  variant = 'body',
  color = 'primary',
  latin = false,
  style,
  ...rest
}: AppTextProps) {
  const { direction } = useI18n();
  const base: TextStyle = {
    ...typography[variant],
    color: colorMap[color],
    writingDirection: latin ? 'ltr' : direction,
  };
  return <RNText {...rest} style={[base, style]} />;
}
