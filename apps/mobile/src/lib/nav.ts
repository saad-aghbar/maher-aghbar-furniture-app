import { useRouter } from 'expo-router';
import { useMemo } from 'react';

/**
 * Navigation wrapper for the app's dynamic, permission-driven routes.
 * Hrefs are assembled at runtime (from the workspace link table and record ids),
 * so they cannot satisfy Expo Router's generated literal union. The cast is
 * confined to this helper instead of being repeated in every screen.
 */
export function useNav() {
  const router = useRouter();
  return useMemo(
    () => ({
      push: (href: string) => router.push(href as never),
      replace: (href: string) => router.replace(href as never),
      back: () => router.back(),
    }),
    [router],
  );
}
