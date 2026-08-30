import type { AuthUser } from '@maher/types';
import type { AppSurface } from '@maher/permissions';
import { resolveAppSurface, resolveMobileHomeHref } from '@maher/permissions';

/** Existing forbidden screen — wrong-surface deep links land here, not Home. */
export const FORBIDDEN_HREF = '/(app)/_forbidden';

/** Own-surface home (Home button on the forbidden screen). */
export function correctSurfaceHref(user: AuthUser): string {
  return resolveMobileHomeHref(user);
}

/** Deep link hit a surface this role cannot open. */
export function wrongSurfaceHref(): string {
  return FORBIDDEN_HREF;
}

export function isCorrectSurface(user: AuthUser, expected: AppSurface): boolean {
  return resolveAppSurface(user) === expected;
}

/** Deep-link denial when tab is not in the visible set for this user. */
export function shouldForbidTab(
  user: AuthUser,
  expectedSurface: AppSurface,
  tabName: string,
  isTabAllowed: (surface: AppSurface, tab: string, u: AuthUser) => boolean,
): boolean {
  if (!isCorrectSurface(user, expectedSurface)) return true;
  return !isTabAllowed(expectedSurface, tabName, user);
}
