import type { AuthUser } from '@maher/types';
import type { AppSurface } from '@maher/permissions';
import { resolveAppSurface, resolveMobileHomeHref } from '@maher/permissions';

/** Correct home when user lands on the wrong surface group. */
export function correctSurfaceHref(user: AuthUser): string {
  return resolveMobileHomeHref(user);
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
