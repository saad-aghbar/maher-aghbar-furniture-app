import { ROLE_PERMISSIONS } from '@maher/permissions';

/** Catalog grants for a system administrator, even if RolePermission rows lag a seed. */
export function effectivePermissionCodes(
  roles: readonly string[],
  dbCodes: readonly string[],
): string[] {
  const set = new Set(dbCodes);
  if (roles.includes('SYSTEM_ADMINISTRATOR') || set.has('*')) {
    for (const code of ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR) set.add(code);
  }
  return [...set];
}

export function actorHoldsPermission(
  actor: { roles: readonly string[]; permissions: readonly string[] },
  code: string,
): boolean {
  if (actor.roles.includes('SYSTEM_ADMINISTRATOR')) return true;
  if (actor.permissions.includes('*')) return true;
  return actor.permissions.includes(code);
}
