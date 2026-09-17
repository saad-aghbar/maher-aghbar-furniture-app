import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AdaptiveShell } from '@/navigation/AdaptiveShell';
import { useStackMotionOptions } from '@/navigation/stackMotion';
import { resolveAppSurface } from '@/permissions';
import { EmployeeThemeOverride, useTheme } from '@/theme';

export default function AppLayout() {
  const { status, user } = useAuth();
  const { colors } = useTheme();
  const stackMotion = useStackMotionOptions();

  if (status === 'bootstrapping' || status === 'authenticating') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (status === 'needs_biometric') {
    return <Redirect href={'/(auth)/unlock' as Href} />;
  }

  if (status !== 'authenticated' || !user) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }

  const surface = resolveAppSurface(user);

  const shell = (
    <AdaptiveShell surface={surface}>
      <Stack screenOptions={stackMotion}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(employee)" />
        <Stack.Screen name="notifications/index" />
        <Stack.Screen
          name="search/index"
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="_forbidden" />
      </Stack>
    </AdaptiveShell>
  );

  // Worker surface only — admin/dealer keep global cream/liquorice themes.
  if (surface === 'employee') {
    return <EmployeeThemeOverride>{shell}</EmployeeThemeOverride>;
  }

  return shell;
}
