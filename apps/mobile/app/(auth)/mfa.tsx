import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthGateScreen } from '@/components/auth/AuthGateScreen';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';

export default function MfaScreen() {
  const router = useRouter();
  const { login, pendingMfa, status } = useAuth();
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  if (!pendingMfa) {
    return (
      <AuthGateScreen title={t('auth.login')}>
        <PrimaryButton
          label={t('auth.signInAgain')}
          onPress={() => router.replace('/(auth)/login' as Href)}
        />
      </AuthGateScreen>
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
    <AuthGateScreen title={t('auth.mfaSetup')} description={t('auth.mfaRequired')}>
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
    </AuthGateScreen>
  );
}
