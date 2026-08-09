import { useState, type RefObject } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';
import type { LoginColors } from '../theme/loginColors';

type Props = {
  colors: LoginColors;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onFocusChange?: (focused: boolean) => void;
  testID?: string;
  inputRef?: RefObject<TextInput | null>;
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
};

export function LoginInput({
  colors,
  label,
  value,
  onChangeText,
  editable = true,
  error,
  containerStyle,
  returnKeyType,
  onSubmitEditing,
  onFocusChange,
  inputRef,
  textContentType = 'username',
  autoComplete = 'username',
  testID,
}: Props) {
  const { theme } = useTheme();
  const { isRTL, locale } = useLocale();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [error ? colors.error : colors.inputBorder, colors.borderFocus],
    ),
  }));

  const accentStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scaleX: 0.35 + focus.value * 0.65 }],
  }));

  return (
    <View style={[{ gap: theme.spacing.xs, width: '100%' }, containerStyle]}>
      <AppText
        variant="label"
        style={{ color: focused ? colors.brandGold : colors.textSecondary }}
      >
        {label}
      </AppText>
      <Animated.View
        style={[
          {
            minHeight: theme.sizes.touch.min,
            borderWidth: 1,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.inputBackground,
            paddingHorizontal: theme.spacing.md,
            justifyContent: 'center',
            overflow: 'hidden',
          },
          borderStyle,
        ]}
      >
        <TextInput
          ref={inputRef}
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          placeholderTextColor={colors.textMuted}
          onFocus={() => {
            setFocused(true);
            focus.value = withTiming(1, { duration: 180 });
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            focus.value = withTiming(0, { duration: 180 });
            onFocusChange?.(false);
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            color: colors.textPrimary,
            fontSize: theme.typography.variants.body.fontSize,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
            paddingVertical: theme.spacing.md,
            ...resolveAppFontStyle(locale, { variant: 'body' }),
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: colors.brandGold,
            },
            accentStyle,
          ]}
        />
      </Animated.View>
    </View>
  );
}
