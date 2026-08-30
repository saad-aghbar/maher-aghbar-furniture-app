import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { promptBiometricUnlock } from '@/auth/biometrics';
import { AuthGateScreen } from '@/components/auth/AuthGateScreen';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';

export default function UnlockScreen() {
  const { completeBiometric, failBiometricToPassword, status } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  const tryUnlock = async () => {
    setBusy(true);
    const ok = await promptBiometricUnlock(t('auth.biometricPrompt'), t('common.cancel'));
    setBusy(false);
    if (ok) {
      completeBiometric();
      router.replace('/(app)' as Href);
    }
  };

  useEffect(() => {
    if (status === 'needs_biometric') {
      void tryUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prompt once on mount
  }, []);

  return (
    <AuthGateScreen title={t('auth.biometricUnlock')}>
      <PrimaryButton
        label={t('auth.biometricUnlock')}
        loading={busy}
        onPress={() => {
          void tryUnlock();
        }}
      />
      <SecondaryButton
        label={t('auth.usePassword')}
        onPress={() => {
          void failBiometricToPassword().then(() => router.replace('/(auth)/login' as Href));
        }}
      />
    </AuthGateScreen>
  );
}
