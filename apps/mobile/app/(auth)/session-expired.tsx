import { useRouter, type Href } from 'expo-router';
import { AuthGateScreen } from '@/components/auth/AuthGateScreen';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useLocale } from '@/i18n';

export default function SessionExpiredScreen() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <AuthGateScreen title={t('auth.sessionExpired')}>
      <PrimaryButton
        label={t('auth.signInAgain')}
        onPress={() => router.replace('/(auth)/login' as Href)}
      />
    </AuthGateScreen>
  );
}
