import { resolveAppSurface } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

export type LoginPortal = 'admin' | 'dealer' | 'worker';

const PORTAL_SURFACE = {
  admin: 'admin',
  dealer: 'customer',
  worker: 'employee',
} as const;

const PORTAL_HOME: Record<LoginPortal, string> = {
  admin: '/admin/dashboard',
  dealer: '/dealer/dashboard',
  worker: '/worker/dashboard',
};

export function portalMatches(portal: LoginPortal, user: AuthUser): boolean {
  return resolveAppSurface(user) === PORTAL_SURFACE[portal];
}

/** Locale-less path for the next-intl router. `next` is kept only inside the chosen portal. */
export function loginDestination(portal: LoginPortal, locale: string, nextPath?: string | null): string {
  const home = PORTAL_HOME[portal];
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) return home;

  let path = nextPath;
  if (path.startsWith(`/${locale}/`)) path = path.slice(locale.length + 1);
  if (!path.startsWith('/')) path = `/${path}`;

  const prefix = `/${portal}`;
  if (path === prefix || path.startsWith(`${prefix}/`)) return path;
  return home;
}
