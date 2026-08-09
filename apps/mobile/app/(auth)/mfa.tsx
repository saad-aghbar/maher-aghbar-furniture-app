import { useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { KeyboardAwareScreen } from '@/components/layout/KeyboardAwareScreen';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export default function MfaScreen() {
  const router = useRouter();
  const { login, pendingMfa, status } = useAuth();
  const { t } = useLocale();
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  if (!pendingMfa) {
    return (
      <KeyboardAwareScreen>
        <AppText>{t('auth.login')}</AppText>
        <PrimaryButton
          label={t('auth.signInAgain')}
          onPress={() => router.replace('/(auth)/login' as Href)}
        />
      </KeyboardAwareScreen>
    );
  }

  const onSubmit = async () => {
    setError(undefined);
    const result = await login({
      username: pendingMfa.username,
      password: pendingMfa.password,
      mfaCode: code.trim(),
    });
    if (result.ok) {
      router.replace('/(app)' as Href);
      return;
    }
    if (result.error === 'mfa_invalid') setError(t('auth.mfaInvalid'));
    else setError(t('auth.loginError'));
  };

  return (
    <KeyboardAwareScreen contentContainerStyle={{ justifyContent: 'center', gap: theme.spacing.xl }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <BrandMark size="lg" />
        <AppText variant="heading" align="center">
          {t('auth.mfaSetup')}
        </AppText>
        <AppText variant="bodySecondary" color="secondary" align="center">
          {t('auth.mfaRequired')}
        </AppText>
      </View>
      <TextField
        label={t('auth.mfaCode')}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
        error={error}
      />
      <PrimaryButton
        label={t('auth.login')}
        loading={status === 'authenticating'}
        disabled={code.trim().length < 6}
        onPress={() => {
          void onSubmit();
        }}
      />
    </KeyboardAwareScreen>
  );
}
