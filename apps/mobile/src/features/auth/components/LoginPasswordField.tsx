import { useState, type RefObject } from 'react';
import {
  Pressable,
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
import { haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import type { LoginColors } from '../theme/loginColors';
import { PasswordVisibilityIcon } from './PasswordVisibilityIcon';

type Props = {
  colors: LoginColors;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  showLabel: string;
  hideLabel: string;
  editable?: boolean;
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onFocusChange?: (focused: boolean) => void;
  inputRef?: RefObject<TextInput | null>;
  testID?: string;
};

export function LoginPasswordField({
  colors,
  label,
  value,
  onChangeText,
  showLabel,
  hideLabel,
  editable = true,
  error,
  containerStyle,
  returnKeyType = 'go',
  onSubmitEditing,
  onFocusChange,
  inputRef,
  testID,
}: Props) {
  const { theme } = useTheme();
  const { isRTL, locale } = useLocale();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [error ? colors.error : colors.inputBorder, colors.borderFocus],
    ),
  }));

  const eyeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? hideLabel : showLabel}
      accessibilityState={{ checked: visible }}
      hitSlop={8}
      onPress={() => {
        void haptics.selection();
        setVisible((v) => !v);
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        minWidth: theme.sizes.touch.min,
        marginLeft: isRTL ? -2 : theme.spacing.xs,
        marginRight: isRTL ? theme.spacing.xs : -2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PasswordVisibilityIcon open={visible} color={colors.brandGold} size={22} />
    </Pressable>
  );

  const input = (
    <TextInput
      ref={inputRef}
      testID={testID}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      autoComplete="password"
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
        flex: 1,
        minHeight: theme.sizes.touch.min,
        color: colors.textPrimary,
        fontSize: theme.typography.variants.body.fontSize,
        textAlign: isRTL ? 'right' : 'left',
        writingDirection: isRTL ? 'rtl' : 'ltr',
        paddingVertical: theme.spacing.md,
        ...resolveAppFontStyle(locale, { variant: 'body' }),
      }}
    />
  );

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
            // Physical sides: eye right in EN, eye left in AR/HE (no row-reverse double-flip)
            direction: 'ltr',
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: theme.sizes.touch.min,
            borderWidth: 1,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.inputBackground,
            paddingLeft: isRTL ? theme.spacing.xs : theme.spacing.md,
            paddingRight: isRTL ? theme.spacing.md : theme.spacing.xs,
          },
          borderStyle,
        ]}
      >
        {isRTL ? (
          <>
            {eyeButton}
            {input}
          </>
        ) : (
          <>
            {input}
            {eyeButton}
          </>
        )}
      </Animated.View>
    </View>
  );
}
