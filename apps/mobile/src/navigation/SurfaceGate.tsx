import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { ForbiddenView } from '@/navigation/ForbiddenView';
import { useStackMotionOptions } from '@/navigation/stackMotion';
import { resolveAppSurface, type AppSurface } from '@/permissions';

type SurfaceGateProps = {
  expected: AppSurface;
};

/**
 * Surface gate + nested Stack so products/details push without unmounting the app chrome.
 * Wrong surface: keep the Stack so grouped tab roots still match, and cover with
 * the existing forbidden screen (do not bounce to Home, do not show worker/dealer Home).
 * `_forbidden.tsx` is a `_` file — Expo may not treat a Redirect there as a route.
 */
export function SurfaceGate({ expected }: SurfaceGateProps) {
  const { status, user } = useAuth();
  const stackMotion = useStackMotionOptions();

  if (status === 'bootstrapping' || status === 'authenticating' || !user) {
    return <Stack screenOptions={stackMotion} />;
  }

  const allowed = resolveAppSurface(user) === expected;

  return (
    <>
      <Stack screenOptions={stackMotion} />
      {allowed ? null : (
        <View style={styles.cover} pointerEvents="auto">
          <ForbiddenView />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
