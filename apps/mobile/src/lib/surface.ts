import type { AuthUser } from '@maher/types';
import { resolveAppSurface, type AppSurface } from '@maher/permissions';

export type { AppSurface };

export function getUserSurface(user: AuthUser): AppSurface {
  return resolveAppSurface(user);
}

export function surfaceHomeHref(surface: AppSurface): '/(app)/admin' | '/(app)/customer' | '/(app)/employee' {
  if (surface === 'customer') return '/(app)/customer';
  if (surface === 'employee') return '/(app)/employee';
  return '/(app)/admin';
}
