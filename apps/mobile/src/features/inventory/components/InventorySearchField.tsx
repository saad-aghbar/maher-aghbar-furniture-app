import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

/**
 * Inventory hub search — oatmeal pill (Apple White), not leftover iOS white.
 */
export function InventorySearchField({ value, onChangeText, placeholder }: Props) {
  const { isRTL, locale, t } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const oatmeal = colors.background;

  return (
    <View
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: colors.brand,
        backgroundColor: oatmeal,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons name="search-outline" size={18} color={colors.brand} />
      <AppTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        underlineColorAndroid="transparent"
        keyboardAppearance={colorScheme === 'dark' ? 'dark' : 'light'}
        accessibilityLabel={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: theme.sizes.touch.min - 8,
          paddingVertical: 0,
          backgroundColor: oatmeal,
          color: colors.textPrimary,
          fontSize: theme.typography.variants.body.fontSize,
          lineHeight: theme.typography.variants.body.lineHeight,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
          ...resolveAppFontStyle(locale, { variant: 'body' }),
        }}
      />
      {value.length > 0 ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => {
            void haptics.selection();
            onChangeText('');
          }}
          hitSlop={8}
          style={{
            minWidth: 28,
            minHeight: 28,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
