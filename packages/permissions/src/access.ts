import type { AuthUser } from '@maher/types';
import type { Permission } from './catalog';
import { hasPermission } from './check';

/** User has a single permission. */
export function can(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return hasPermission(user.permissions, permission);
}

/** User has at least one of the permissions. */
export function canAny(
  user: AuthUser | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!user || permissions.length === 0) return false;
  return permissions.some((p) => hasPermission(user.permissions, p));
}

/** User has every listed permission (same as `hasPermission` with an array). */
export function canAll(
  user: AuthUser | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!user) return false;
  if (permissions.length === 0) return true;
  return hasPermission(user.permissions, [...permissions]);
}
