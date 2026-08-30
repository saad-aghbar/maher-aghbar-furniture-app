import { Redirect, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { useStackMotionOptions } from '@/navigation/stackMotion';
import { wrongSurfaceHref } from '@/navigation/surfaceGuard';
import { resolveAppSurface, type AppSurface } from '@/permissions';

type SurfaceGateProps = {
  expected: AppSurface;
};

/**
 * Surface gate + nested Stack so products/details push without unmounting the app chrome.
 * Tab bar is mounted once at `app/(app)/_layout` so it never disappears.
 */
export function SurfaceGate({ expected }: SurfaceGateProps) {
  const { status, user } = useAuth();
  const stackMotion = useStackMotionOptions();

  if (status === 'bootstrapping' || status === 'authenticating' || !user) {
    return null;
  }

  if (resolveAppSurface(user) !== expected) {
    return <Redirect href={wrongSurfaceHref() as Href} />;
  }

  return <Stack screenOptions={stackMotion} />;
}
