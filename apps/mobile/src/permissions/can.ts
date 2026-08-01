import type { AuthUser } from '@maher/types';

export function can(
  user: AuthUser | null | undefined,
  permission: import('@maher/permissions').Permission,
): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function canAny(
  user: AuthUser | null | undefined,
  permissions: readonly import('@maher/permissions').Permission[],
): boolean {
  return permissions.some((p) => can(user, p));
}

export function canAll(
  user: AuthUser | null | undefined,
  permissions: readonly import('@maher/permissions').Permission[],
): boolean {
  return permissions.every((p) => can(user, p));
}

export {
  resolveAppSurface,
  resolveHomePersona,
  resolveMobileHomeHref,
  resolveWebHomePath,
} from '@maher/permissions';
export type { HomePersona, AppSurface } from '@maher/permissions';
