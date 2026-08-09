import { useRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { FormShake } from '@/motion';
import { useTheme } from '@/theme';
import type { LoginColors } from '../theme/loginColors';
import { LoginButton } from './LoginButton';
import { LoginError } from './LoginError';
import { LoginInput } from './LoginInput';
import { LoginPasswordField } from './LoginPasswordField';

/** Minimal motion contract for staggered glass form reveal. */
export type LoginFormMotion = {
  formOpacity: SharedValue<number>;
  formY: SharedValue<number>;
  field0: SharedValue<number>;
  field1: SharedValue<number>;
  field2: SharedValue<number>;
};

type Props = {
  motion: LoginFormMotion;
  colors: LoginColors;
  username: string;
  password: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  usernameLabel: string;
  passwordLabel: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  signInLabel: string;
  signingInLabel: string;
  errorMessage?: string;
  shakeKey: number;
  disabled: boolean;
  loading: boolean;
  success: boolean;
  rateLimited: boolean;
  onSubmit: () => void;
  onFocusChange?: (focused: boolean) => void;
};

export function LoginForm({
  motion,
  colors,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  usernameLabel,
  passwordLabel,
  showPasswordLabel,
  hidePasswordLabel,
  signInLabel,
  signingInLabel,
  errorMessage,
  shakeKey,
  disabled,
  loading,
  success,
  rateLimited,
  onSubmit,
  onFocusChange,
}: Props) {
  const { theme } = useTheme();
  const passwordRef = useRef<TextInput>(null);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: motion.formOpacity.value,
    transform: [{ translateY: motion.formY.value }],
  }));

  const f0 = useAnimatedStyle(() => ({
    opacity: motion.field0.value,
    transform: [{ translateY: (1 - motion.field0.value) * 12 }],
  }));
  const f1 = useAnimatedStyle(() => ({
    opacity: motion.field1.value,
    transform: [{ translateY: (1 - motion.field1.value) * 12 }],
  }));
  const f2 = useAnimatedStyle(() => ({
    opacity: motion.field2.value,
    transform: [{ translateY: (1 - motion.field2.value) * 12 }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          alignSelf: 'stretch',
          borderRadius: theme.radius.xl,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: colors.border,
          overflow: 'hidden',
          ...theme.elevation.raised,
          shadowColor: '#000',
          shadowOpacity: 0.18,
        },
        cardStyle,
      ]}
    >
      <BlurView
        intensity={colors.blurIntensity}
        tint={colors.blurTint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          backgroundColor: colors.surfaceGlass,
          padding: theme.spacing.xl,
          gap: theme.spacing.lg,
          // Android BlurView can be weak — solid fallback layer
          ...(Platform.OS === 'android' ? { backgroundColor: colors.surfaceSolid } : null),
        }}
      >
        <FormShake shakeKey={shakeKey}>
          <View style={{ gap: theme.spacing.lg }}>
            <Animated.View style={f0}>
              <LoginInput
                colors={colors}
                label={usernameLabel}
                value={username}
                onChangeText={onUsernameChange}
                editable={!loading && !rateLimited && !success}
                error={Boolean(errorMessage)}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocusChange={onFocusChange}
                testID="username-input"
              />
            </Animated.View>
            <Animated.View style={f1}>
              <LoginPasswordField
                colors={colors}
                label={passwordLabel}
                value={password}
                onChangeText={onPasswordChange}
                showLabel={showPasswordLabel}
                hideLabel={hidePasswordLabel}
                editable={!loading && !success}
                error={Boolean(errorMessage)}
                inputRef={passwordRef}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (!disabled) onSubmit();
                }}
                onFocusChange={onFocusChange}
                testID="password-input"
              />
            </Animated.View>
            <LoginError colors={colors} message={errorMessage} />
            <Animated.View style={f2}>
              <LoginButton
                colors={colors}
                label={signInLabel}
                loadingLabel={signingInLabel}
                onPress={onSubmit}
                disabled={disabled}
                loading={loading}
                success={success}
                testID="sign-in-button"
              />
            </Animated.View>
          </View>
        </FormShake>
      </View>
    </Animated.View>
  );
}
