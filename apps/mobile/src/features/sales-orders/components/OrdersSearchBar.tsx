import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
};

/**
 * Apple White field, Liquorice icon, Tumbleweed placeholder — not a cool-grey iOS search.
 */
export function OrdersSearchBar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: Props) {
  const { isRTL, locale, t } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.background,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
        ...theme.elevation.rest,
      }}
    >
      <Ionicons name="search-outline" size={18} color={colors.textPrimary} />
      <AppTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.brandActive}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        underlineColorAndroid="transparent"
        clearButtonMode="never"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: theme.sizes.touch.min - 8,
          paddingVertical: 0,
          color: colors.textPrimary,
          fontSize: 15,
          lineHeight: 20,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
          ...resolveAppFontStyle(locale, { variant: 'body' }),
        }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.orders.filterDealerClear')}
          hitSlop={8}
          style={{
            minWidth: 28,
            minHeight: 28,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close-circle" size={18} color={colors.brandActive} />
        </Pressable>
      ) : null}
    </View>
  );
}
