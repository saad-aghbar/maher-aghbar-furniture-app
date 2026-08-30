import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

/**
 * Shared Apple search language — pill, icon bubble, clear-while-editing.
 * Colors stay on brand neutrals; the field shape is not restyled.
 */
export function InventorySearchField({ value, onChangeText, placeholder }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <SearchBarShell
      iconColor={colors.brand}
      iconBubbleColor={colors.surface}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <AppTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: theme.sizes.touch.min - 8,
          paddingVertical: 0,
          backgroundColor: 'transparent',
          color: colors.textPrimary,
          fontSize: theme.typography.variants.body.fontSize,
          lineHeight: theme.typography.variants.body.lineHeight,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
          ...resolveAppFontStyle(locale, { variant: 'body' }),
        }}
      />
    </SearchBarShell>
  );
}
