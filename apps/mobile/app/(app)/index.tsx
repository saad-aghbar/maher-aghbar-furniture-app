import { Redirect, usePathname, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { GlobalSearchScreen } from '@/features/search/GlobalSearchScreen';
import { ForbiddenView } from '@/navigation/ForbiddenView';
import {
  shouldPresentGlobalSearch,
  shouldPresentWrongSurfaceForbidden,
  shouldRedirectAppIndex,
} from '@/navigation/appIndexPath';
import { resolveAppSurface, resolveMobileHomeHref } from '@/permissions';

/**
 * Safety Redirect into the correct surface tabs — never steal a real destination.
 * Search deep links that Expo still focuses as `/` present search from the
 * launch URL so they do not dump on admin Home. Grouped customer/employee
 * tab roots do the same with ForbiddenView when the session is the wrong
 * surface — never overlay dealer Home on an admin session.
 */
export default function AppIndexRedirect() {
  const { user } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  const liveUrl = Linking.useURL();
  const [initialUrl, setInitialUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void Linking.getInitialURL().then(setInitialUrl);
  }, []);

  if (!user) return <Redirect href={'/(auth)/login' as Href} />;

  if (initialUrl === undefined && liveUrl == null) {
    return null;
  }

  const launchUrl = liveUrl ?? initialUrl ?? null;
  if (shouldPresentGlobalSearch(pathname, segments, launchUrl)) {
    return <GlobalSearchScreen />;
  }

  if (
    shouldPresentWrongSurfaceForbidden(
      pathname,
      segments,
      launchUrl,
      resolveAppSurface(user),
    )
  ) {
    return <ForbiddenView />;
  }

  if (!shouldRedirectAppIndex(pathname, segments)) return null;
  return <Redirect href={resolveMobileHomeHref(user) as Href} />;
}
