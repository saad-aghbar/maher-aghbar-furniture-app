import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { promptBiometricUnlock } from '@/auth/biometrics';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export default function UnlockScreen() {
  const { completeBiometric, failBiometricToPassword, status } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);

  const tryUnlock = async () => {
    setBusy(true);
    const ok = await promptBiometricUnlock(t('auth.biometricPrompt'));
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
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xl, alignItems: 'center' }}>
        <BrandMark size="xl" />
        <AppText variant="heading" align="center">
          {t('auth.biometricUnlock')}
        </AppText>
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
      </View>
    </AppScreen>
  );
}
