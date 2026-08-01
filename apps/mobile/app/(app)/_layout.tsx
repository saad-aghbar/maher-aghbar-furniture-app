import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/providers/auth-provider';
import { useI18n } from '../../src/providers/i18n-provider';
import { colors, typography } from '../../src/theme/tokens';

/**
 * Authenticated stack. The tab bar lives in `(tabs)`; every feature list and
 * detail screen pushes on top of it with a native header.
 */
export default function AppLayout() {
  const { user } = useAuth();
  const { direction } = useI18n();

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.brand,
        headerTitleStyle: { ...typography.heading, color: colors.textPrimary },
        headerShadowVisible: false,
        headerBackTitle: '',
        contentStyle: { backgroundColor: colors.background },
        animation: direction === 'rtl' ? 'slide_from_left' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
