import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthGateScreen } from '@/components/auth/AuthGateScreen';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';

export default function OfflineScreen() {
  const { bootstrap, status } = useAuth();
  const router = useRouter();
  const { t } = useLocale();

  return (
    <AuthGateScreen title={t('auth.networkError')}>
      <PrimaryButton
        label={t('auth.retryConnection')}
        loading={status === 'bootstrapping'}
        onPress={() => {
          void bootstrap().then(() => {
            router.replace('/' as Href);
          });
        }}
      />
      <SecondaryButton
        label={t('auth.signInAgain')}
        onPress={() => router.replace('/(auth)/login' as Href)}
      />
    </AuthGateScreen>
  );
}
