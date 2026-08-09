import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useLocale } from '@/i18n/useLocale';
import {
  resolveAppFontStyle,
  resolveArabicTextMetrics,
  useTheme,
  type TypographyVariantName,
} from '@/theme';

type AppTextProps = TextProps & {
  variant?: TypographyVariantName;
  color?: 'primary' | 'secondary' | 'muted' | 'brand' | 'onBrand' | 'error' | 'success' | 'warning';
  weight?: 'regular' | 'medium' | 'semibold';
  align?: 'auto' | 'start' | 'center' | 'end';
  /**
   * Force LTR for Latin numerals, order codes, currency (keeps RTL textAlign so
   * the block still sits on the reading-start edge in Arabic).
   */
  dir?: 'auto' | 'ltr' | 'rtl';
};

/**
 * Themed text with locale-aware alignment and Arabic KO Sans typeface.
 * Prefer this over raw `Text` in feature UI.
 */
export function AppText({
  variant = 'body',
  color = 'primary',
  weight,
  align = 'auto',
  dir = 'auto',
  style,
  ...rest
}: AppTextProps) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();
  const v = theme.typography.variants[variant];
  const systemWeight = weight ? theme.typography.weights[weight] : v.fontWeight;

  const colorMap = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    brand: colors.brand,
    onBrand: colors.onBrand,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
  } as const;

  let textAlign: TextStyle['textAlign'] = 'left';
  if (align === 'auto') textAlign = isRTL ? 'right' : 'left';
  else if (align === 'start') textAlign = isRTL ? 'right' : 'left';
  else if (align === 'end') textAlign = isRTL ? 'left' : 'right';
  else textAlign = 'center';

  const writingDirection: TextStyle['writingDirection'] =
    dir === 'ltr' ? 'ltr' : dir === 'rtl' ? 'rtl' : isRTL ? 'rtl' : 'ltr';

  const composed: StyleProp<TextStyle> = [
    {
      fontSize: v.fontSize,
      lineHeight: v.lineHeight,
      letterSpacing: locale === 'ar' ? 0 : v.letterSpacing,
      color: colorMap[color],
      textAlign,
      writingDirection,
      ...resolveAppFontStyle(locale, { weight, variant, systemWeight }),
    },
    style,
    // Win over Latin optical tracking passed via `style` (e.g. letterSpacing: -1.1).
    locale === 'ar' ? { letterSpacing: 0 } : null,
  ];

  return (
    <Text
      {...rest}
      style={[composed, resolveArabicTextMetrics(locale, composed)]}
    />
  );
}
