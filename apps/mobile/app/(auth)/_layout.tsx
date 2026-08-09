import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { useStackMotionOptions } from '@/navigation/stackMotion';
import { resolveMobileHomeHref } from '@/permissions';
import type { Href } from 'expo-router';

export default function AuthLayout() {
  const { status, user } = useAuth();
  const stackMotion = useStackMotionOptions();

  if (status === 'authenticated' && user) {
    return <Redirect href={resolveMobileHomeHref(user) as Href} />;
  }

  return (
    <Stack screenOptions={stackMotion}>
      <Stack.Screen name="login" />
      <Stack.Screen name="mfa" />
      <Stack.Screen name="disabled" />
      <Stack.Screen name="session-expired" />
      <Stack.Screen name="offline" />
      <Stack.Screen name="unlock" />
    </Stack>
  );
}
