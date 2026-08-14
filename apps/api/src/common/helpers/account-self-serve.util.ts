/** Identity roles that may edit their own name, email, phone, password, or MFA. */

export function isSystemAdministrator(roles: readonly string[]): boolean {
  return roles.includes('SYSTEM_ADMINISTRATOR');
}

/** Admins and dealers may edit profile fields. Staff and workers may not. */
export function canEditOwnProfile(
  roles: readonly string[],
  customerId?: string | null,
): boolean {
  return isSystemAdministrator(roles) || Boolean(customerId);
}

/** Only system administrators may change their own password. */
export function canChangeOwnPassword(roles: readonly string[]): boolean {
  return isSystemAdministrator(roles);
}

/** Admins and dealers may manage MFA. Staff and workers match the worker profile. */
export function canManageOwnMfa(
  roles: readonly string[],
  customerId?: string | null,
): boolean {
  return isSystemAdministrator(roles) || Boolean(customerId);
}
