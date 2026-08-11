import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AnimatedBrandIntro } from '@/components/branding';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { KeyboardAwareScreen } from '@/components/layout/KeyboardAwareScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useBrandIntroState } from '@/hooks/useBrandIntroState';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { resetBrandIntroSessionFlags } from '@/theme/brandIntroMotion';
import { useTheme } from '@/theme';
import { AmbientBackground } from '../components/AmbientBackground';
import { LoginLanguageSwitcher } from '../components/LoginLanguageSwitcher';
import { LoginThemeSwitcher } from '../components/LoginThemeSwitcher';
import { LoginScreenContent } from '../LoginScreenContent';
import { mapLoginErrorMessage, useLoginForm } from '../hooks/useLoginForm';
import { getLoginColors } from '../theme/loginColors';

/**
 * Shared login — Netflix-style logo sting, then furniture commerce form.
 * Username/password only (no email). Language + theme chrome. Offline banner.
 * Auth stays on AuthProvider.login; SplashGate still gates session restore.
 */
export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, status, lastLoginError, clearLoginError } = useAuth();
  const { t } = useLocale();
  const { theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const { height: winH } = useWindowDimensions();
  const colors = useMemo(() => getLoginColors(colorScheme), [colorScheme]);
  const darkArtwork = colorScheme === 'dark';
  const logoWidth = keyboardOpen ? 160 : 260;
  /** Sit form just under the settled lockup slot */
  const formTopPad = Math.round(winH * 0.2 + logoWidth / 2.45 + 120);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    resetBrandIntroSessionFlags();
  }

  const intro = useBrandIntroState({ autoPlay: true });

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const onSuccess = useCallback(async () => {
    void haptics.completeStrong();
    await new Promise((r) => setTimeout(r, 520));
    router.replace('/(app)' as Href);
  }, [router]);

  const form = useLoginForm({
    login,
    clearLoginError,
    lastLoginError,
    authenticating: status === 'authenticating',
    showOfflineBanner,
    onOffline: () => router.push('/(auth)/offline' as Href),
    onSuccess,
    onMfa: () => router.push('/(auth)/mfa' as Href),
    onDisabled: () => router.replace('/(auth)/disabled' as Href),
  });

  const err = mapLoginErrorMessage(form.errorCode, t);

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: intro.shared.chromeOpacity.value,
  }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="login-screen">
      <StatusBar barStyle={darkArtwork ? 'light-content' : 'dark-content'} />
      <AmbientBackground
        colors={colors}
        canvasProgress={intro.shared.bgProgress}
        darkArtwork={darkArtwork}
      />
      <OfflineBanner />

      <AnimatedBrandIntro
        intro={intro}
        darkArtwork={darkArtwork}
        logoWidth={logoWidth}
      />

      <Animated.View
        style={[
          styles.chrome,
          {
            paddingTop: insets.top + theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
          },
          chromeStyle,
        ]}
        pointerEvents="box-none"
      >
        <LoginLanguageSwitcher colors={colors} />
        <LoginThemeSwitcher colors={colors} />
      </Animated.View>

      <KeyboardAwareScreen
        style={{ backgroundColor: 'transparent', zIndex: 10 }}
        contentContainerStyle={{
          justifyContent: 'flex-start',
          gap: theme.spacing.lg,
          paddingTop: formTopPad,
          paddingHorizontal: 0,
          flexGrow: 1,
          width: '100%',
        }}
      >
        <LoginScreenContent
          intro={intro}
          colors={colors}
          form={{
            username: form.username,
            password: form.password,
            onUsernameChange: (v) => {
              clearLoginError();
              form.setUsername(v);
            },
            onPasswordChange: (v) => {
              clearLoginError();
              form.setPassword(v);
            },
            usernameLabel: t('auth.username'),
            passwordLabel: t('auth.password'),
            showPasswordLabel: t('auth.showPassword'),
            hidePasswordLabel: t('auth.hidePassword'),
            signInLabel: t('auth.login'),
            signingInLabel: t('auth.signingIn'),
            errorMessage: err,
            shakeKey: form.shakeKey,
            disabled: form.disabled,
            loading: form.loading,
            success: form.success,
            rateLimited: form.rateLimited,
            onSubmit: () => {
              void form.onSubmit();
            },
          }}
        />
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
