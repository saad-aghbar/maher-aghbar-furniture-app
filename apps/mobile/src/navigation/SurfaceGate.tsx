import { Stack } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ForbiddenView } from '@/navigation/ForbiddenView';
import { useStackMotionOptions } from '@/navigation/stackMotion';
import { resolveAppSurface, type AppSurface } from '@/permissions';

type SurfaceGateProps = {
  expected: AppSurface;
};

/**
 * Surface gate + nested Stack so products/details push without unmounting the app chrome.
 * Wrong surface: existing forbidden screen in place (do not bounce to Home).
 * `_forbidden.tsx` is a `_` file — Expo may not treat a Redirect there as a route.
 */
export function SurfaceGate({ expected }: SurfaceGateProps) {
  const { status, user } = useAuth();
  const stackMotion = useStackMotionOptions();

  if (status === 'bootstrapping' || status === 'authenticating' || !user) {
    return null;
  }

  if (resolveAppSurface(user) !== expected) {
    return <ForbiddenView />;
  }

  return <Stack screenOptions={stackMotion} />;
}
