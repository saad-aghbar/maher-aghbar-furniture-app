import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthGateScreen } from '@/components/auth/AuthGateScreen';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useLocale } from '@/i18n';

export default function DisabledAccountScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const { t } = useLocale();

  return (
    <AuthGateScreen title={t('auth.accountDisabled')}>
      <PrimaryButton
        label={t('auth.signInAgain')}
        onPress={() => {
          void logout().then(() => router.replace('/(auth)/login' as Href));
        }}
      />
    </AuthGateScreen>
  );
}
