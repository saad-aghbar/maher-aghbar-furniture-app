/**
 * Path helpers for the authenticated (app) stack.
 * `(app)/index` is a safety Redirect into the surface tabs — it must not
 * fire while a sibling like `/search` is the intended route.
 */

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
 * Only the bare `(app)` index should redirect into surface tabs.
 * Surface groups and siblings (`/search`, `/notifications`) stay put.
 */
export function shouldRedirectAppIndex(pathname: string): boolean {
  const raw = pathname.split('/').filter(Boolean);
  const leaf = raw.filter((s) => !s.startsWith('('));
  if (raw.includes('(admin)') || raw.includes('(customer)') || raw.includes('(employee)')) {
    return false;
  }
  if (leaf.length === 1 && (leaf[0] === 'search' || leaf[0] === 'notifications')) {
    return false;
  }
  return leaf.length === 0 || (leaf.length === 1 && leaf[0] === 'index');
}
