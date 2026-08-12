import { Pressable, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onClear?: () => void;
  accessibilityLabel?: string;
} & Pick<TextInputProps, 'autoCapitalize' | 'autoCorrect' | 'returnKeyType'>;

const SHELL_PAD = 6;
const PILL_HEIGHT = 36;

/**
 * Dealer portal search — touch-bar shell (muted track) with a cream inner pill,
 * matching All / Favorites / Ordered and Fabric segment rails.
 */
export function DealerSearchBar({
  value,
  onChangeText,
  placeholder,
  onClear,
  accessibilityLabel,
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType = 'search',
}: Props) {
  const { isRTL, locale, t } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const shellH = SHELL_PAD * 2 + PILL_HEIGHT;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        height: shellH,
        borderRadius: shellH / 2,
        backgroundColor: dark ? 'rgba(42,36,37,0.92)' : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        padding: SHELL_PAD,
        shadowColor: dark ? '#000000' : '#1E1A1B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: dark ? 0.22 : 0.07,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
          shadowColor: dark ? '#000000' : '#1E1A1B',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: dark ? 0.25 : 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <AppTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          style={{
            flex: 1,
            minWidth: 0,
            height: PILL_HEIGHT,
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
            onPress={() => {
              onChangeText('');
              onClear?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.dealerUi.clearSearch')}
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
    </View>
  );
}
