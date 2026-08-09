import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/** Prefer history back; otherwise land on a safe surface home. */
export function useSmartBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallback);
  }, [fallback, router]);
}
