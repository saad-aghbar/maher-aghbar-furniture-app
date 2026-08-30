import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/auth/AuthProvider';
import { BrandMark } from '@/components/BrandMark';
import { AppText } from '@/components/AppText';
import { FadeIn } from '@/motion';
import { authenticatedLandingHref, expoDeepLinkPath, resolveIntentUrl } from '@/navigation/appIndexPath';
import { resolveAppSurface, resolveMobileHomeHref } from '@/permissions';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * Splash / bootstrap gate — restores SecureStore session then redirects.
 * Wait for getInitialURL so `exp://…/--/(app)/search` is not replaced with Home.
 */
export default function SplashGate() {
  const router = useRouter();
  const { status, bootstrap, user } = useAuth();
  const { colors, theme } = useTheme();
  const { t } = useLocale();
  const liveUrl = Linking.useURL();
  const [initialUrl, setInitialUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void Linking.getInitialURL().then(setInitialUrl);
  }, []);

  const incomingUrl = resolveIntentUrl(liveUrl, initialUrl);
  const urlReady = liveUrl != null || initialUrl !== undefined;

  useEffect(() => {
    switch (status) {
      case 'bootstrapping':
      case 'authenticating':
        return;
      case 'authenticated':
        if (!urlReady) return;
        if (user) {
          router.replace(
            authenticatedLandingHref(
              expoDeepLinkPath(incomingUrl),
              resolveMobileHomeHref(user),
              resolveAppSurface(user),
            ) as Href,
          );
        }
        return;
      case 'needs_biometric':
        router.replace('/(auth)/unlock' as Href);
        return;
      case 'disabled':
        router.replace('/(auth)/disabled' as Href);
        return;
      case 'session_expired':
        router.replace('/(auth)/session-expired' as Href);
        return;
      case 'offline':
        router.replace('/(auth)/offline' as Href);
        return;
      case 'unauthenticated':
      default:
        router.replace('/(auth)/login' as Href);
    }
  }, [incomingUrl, urlReady, status, router, user]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing['2xl'],
        gap: theme.spacing.xl,
      }}
    >
      <FadeIn>
        <BrandMark size="xl" />
      </FadeIn>
      <ActivityIndicator color={colors.brand} />
      <AppText variant="bodySecondary" color="secondary" align="center">
        {t('mobile.loadingSession')}
      </AppText>
      {status === 'offline' ? (
        <AppText
          variant="caption"
          color="brand"
          onPress={() => {
            void bootstrap();
          }}
        >
          {t('auth.retryConnection')}
        </AppText>
      ) : null}
    </View>
  );
}
