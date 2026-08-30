/**
 * Path helpers for the authenticated (app) stack.
 * `(app)/index` is a safety Redirect into the surface tabs — it must not
 * fire while a sibling like `/(app)/search` is the intended route.
 */

/** Keep the `(app)` group in the Expo href — never a bare `/search`. */
export const SEARCH_HREF = '/(app)/search';

export function expoDeepLinkPath(url: string | null | undefined): string {
  if (!url) return '';
  const delim = url.indexOf('/--/');
  const raw =
    delim >= 0
      ? url.slice(delim + 4)
      : (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return url;
          }
        })();
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path;
}

function nonGroupSegments(pathname: string): string[] {
  return pathname.split('/').filter((s) => s && !s.startsWith('(') && s !== '--');
}

/** True for `/(app)/search` and Expo Go `exp://…/--/(app)/search`. */
export function isGlobalSearchPath(pathname: string): boolean {
  const leaf = nonGroupSegments(pathname);
  return leaf.length === 1 && leaf[0] === 'search';
}

/**
 * Deep link meant global search even when Expo focused `/` (index)
 * and stripped groups from `usePathname`. Only consult the launch URL when
 * this really looks like the bare app index — not while sitting on Admin Home.
 */
export function shouldPresentGlobalSearch(
  pathname: string,
  segments: readonly string[] = [],
  launchUrl?: string | null,
): boolean {
  if (isGlobalSearchPath(pathname) || segments.includes('search')) return true;
  if (!shouldRedirectAppIndex(pathname, segments)) return false;
  return isGlobalSearchPath(expoDeepLinkPath(launchUrl));
}

export type GroupedAppSurface = 'admin' | 'customer' | 'employee';

/** Keep groups: `/(app)/(customer)/(tabs)` and Expo Go `--/(app)/(customer)/(tabs)`. */
export function groupedSurfaceFromPath(pathname: string): GroupedAppSurface | null {
  const path = expoDeepLinkPath(pathname) || pathname;
  const parts = path.split('/').filter(Boolean);
  if (parts.includes('(customer)')) return 'customer';
  if (parts.includes('(employee)')) return 'employee';
  if (parts.includes('(admin)')) return 'admin';
  return null;
}

/**
 * Grouped customer/employee tab roots have no leaf — Expo often focuses `/`.
 * Admin must see forbidden, not Admin Home, and not dealer Home.
 */
export function shouldPresentWrongSurfaceForbidden(
  pathname: string,
  segments: readonly string[] = [],
  launchUrl: string | null | undefined,
  sessionSurface: string,
): boolean {
  if (!shouldRedirectAppIndex(pathname, segments)) return false;
  const intended = groupedSurfaceFromPath(expoDeepLinkPath(launchUrl) || pathname);
  if (!intended) return false;
  return intended !== sessionSurface;
}

/**
 * After splash/replace, `useURL()` is often `/` and would mask the Expo
 * launch URL that still has `(employee)` / `(customer)` / `search`.
 */
export function resolveIntentUrl(
  liveUrl: string | null | undefined,
  initialUrl: string | null | undefined,
): string | null {
  const initial = initialUrl ?? null;
  const live = liveUrl ?? null;
  const initialPath = expoDeepLinkPath(initial);
  if (isGlobalSearchPath(initialPath) || groupedSurfaceFromPath(initialPath)) {
    return initial;
  }
  const livePath = expoDeepLinkPath(live);
  if (isGlobalSearchPath(livePath) || groupedSurfaceFromPath(livePath)) {
    return live;
  }
  return live ?? initial;
}

/**
 * Only the bare `(app)` index should redirect into surface tabs.
 * Surface groups and siblings stay put.
 *
 * `/(app)/(employee)/(tabs)` has no leaf after groups — Expo often reports
 * pathname `/`, which must not be treated as the app index.
 */
export function shouldRedirectAppIndex(
  pathname: string,
  segments: readonly string[] = [],
): boolean {
  if (
    segments.includes('(admin)') ||
    segments.includes('(customer)') ||
    segments.includes('(employee)')
  ) {
    return false;
  }
  if (
    segments.includes('search') ||
    segments.includes('notifications') ||
    segments.includes('_forbidden')
  ) {
    return false;
  }
  const raw = pathname.split('/').filter(Boolean);
  const leaf = raw.filter((s) => !s.startsWith('('));
  if (raw.includes('(admin)') || raw.includes('(customer)') || raw.includes('(employee)')) {
    return false;
  }
  if (leaf.length === 1 && (leaf[0] === 'search' || leaf[0] === 'notifications' || leaf[0] === '_forbidden')) {
    return false;
  }
  return leaf.length === 0 || (leaf.length === 1 && leaf[0] === 'index');
}

/** Turn an Expo path into an in-app href. Keep `(app)` groups. */
export function asAppHref(pathname: string): string {
  if (isGlobalSearchPath(pathname)) return SEARCH_HREF;
  if (pathname.startsWith('/(app)')) return pathname;
  if (pathname.startsWith('/')) return `/(app)${pathname}`;
  return `/(app)/${pathname}`;
}

/**
 * After session restore: keep a real deep-link destination.
 * SurfaceGate shows ForbiddenView in place — never Home-by-accident.
 */
export function authenticatedLandingHref(
  incomingPath: string,
  homeHref: string,
  sessionSurface?: string,
): string {
  const path = expoDeepLinkPath(incomingPath) || incomingPath;
  const intended = groupedSurfaceFromPath(path);
  if (sessionSurface && intended && intended !== sessionSurface) {
    // Tab roots have no leaf — replacing into them unmatches and dumps Home.
    // Land on `(app)` index so ForbiddenView can present. Keep leaf hrefs
    // (catalog) so SurfaceGate can cover in place.
    if (nonGroupSegments(path).length === 0) return '/(app)';
  }
  if (shouldRedirectAppIndex(incomingPath) || shouldRedirectAppIndex(path)) return homeHref;
  return asAppHref(path);
}
