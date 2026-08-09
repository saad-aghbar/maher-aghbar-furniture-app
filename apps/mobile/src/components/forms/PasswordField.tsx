import { useState } from 'react';
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { PasswordVisibilityIcon } from '@/features/auth/components/PasswordVisibilityIcon';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n/useLocale';
import { resolveAppFontStyle, useTheme } from '@/theme';

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  showLabel: string;
  hideLabel: string;
};

export function PasswordField({
  label,
  value,
  onChangeText,
  error,
  containerStyle,
  showLabel,
  hideLabel,
}: PasswordFieldProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale } = useLocale();
  const [visible, setVisible] = useState(false);

  return (
    <View style={[{ gap: theme.spacing.xs, width: '100%' }, containerStyle]}>
      <AppText variant="label" color="secondary">
        {label}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          minHeight: theme.sizes.touch.min,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.borderStrong,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.surface,
          paddingHorizontal: theme.spacing.md,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            minHeight: theme.sizes.touch.min,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            color: colors.textPrimary,
            fontSize: theme.typography.variants.body.fontSize,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
            ...resolveAppFontStyle(locale, { variant: 'body' }),
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? hideLabel : showLabel}
          accessibilityState={{ checked: visible }}
          onPress={() => setVisible((v) => !v)}
          style={{
            minHeight: theme.sizes.touch.min,
            minWidth: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PasswordVisibilityIcon open={visible} color={colors.brand} size={22} />
        </Pressable>
      </View>
      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
