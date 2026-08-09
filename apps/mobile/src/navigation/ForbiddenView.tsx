import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { useAuth } from '@/auth/AuthProvider';
import { useLocale } from '@/i18n';
import { resolveMobileHomeHref } from '@/permissions';
import { useTheme } from '@/theme';

export function ForbiddenView() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const { theme } = useTheme();

  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xl }}>
        <AppText variant="heading" align="center">
          {t('mobile.noModules')}
        </AppText>
        <AppText variant="bodySecondary" color="secondary" align="center">
          {t('mobile.noModulesHint')}
        </AppText>
        <PrimaryButton
          label={t('mobile.tabs.home')}
          onPress={() => {
            if (user) router.replace(resolveMobileHomeHref(user) as Href);
            else router.replace('/(auth)/login' as Href);
          }}
        />
      </View>
    </AppScreen>
  );
}
