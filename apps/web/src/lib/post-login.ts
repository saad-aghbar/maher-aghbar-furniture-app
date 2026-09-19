import { resolveWebHomePath } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

/** After login, stay on this origin and land on the surface home. */
export function redirectAfterLogin(user: AuthUser, locale: string, nextPath?: string | null): void {
  if (typeof window === 'undefined') return;
  const home = resolveWebHomePath(user);
  if (nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    const trimmed = nextPath.startsWith(`/${locale}/`) ? nextPath.slice(locale.length + 1) : nextPath;
    const safe = trimmed === '/dashboard' || trimmed === 'dashboard' ? home : trimmed;
    window.location.assign(`/${locale}${safe.startsWith('/') ? safe : `/${safe}`}`);
    return;
  }
  window.location.assign(`/${locale}${home}`);
}
