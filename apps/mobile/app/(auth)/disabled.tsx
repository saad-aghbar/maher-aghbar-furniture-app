import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export default function DisabledAccountScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const { theme } = useTheme();

  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xl, alignItems: 'center' }}>
        <BrandMark size="lg" />
        <AppText variant="heading" align="center">
          {t('auth.accountDisabled')}
        </AppText>
        <PrimaryButton
          label={t('auth.signInAgain')}
          onPress={() => {
            void logout().then(() => router.replace('/(auth)/login' as Href));
          }}
        />
      </View>
    </AppScreen>
  );
}
