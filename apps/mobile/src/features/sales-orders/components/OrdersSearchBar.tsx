import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { orderBoardShadow } from './orderFloorStyle';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
};

/**
 * Board search — cream pill + icon bubble, same language as filter / dealer / journey.
 * Not the system iOS search field.
 */
export function OrdersSearchBar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: Props) {
  const { isRTL, locale, t } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <View
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="search-outline" size={16} color={colors.brand} />
      </View>
      <AppTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
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
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
