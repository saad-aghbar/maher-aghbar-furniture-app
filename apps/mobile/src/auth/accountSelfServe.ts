/** Staff and floor workers cannot self-edit identity or credentials — same as worker profile. */

export function canEditOwnProfile(user: {
  roles: readonly string[];
  customerId?: string | null;
}): boolean {
  return user.roles.includes('SYSTEM_ADMINISTRATOR') || Boolean(user.customerId);
}

export function canChangeOwnPassword(user: { roles: readonly string[] }): boolean {
  return user.roles.includes('SYSTEM_ADMINISTRATOR');
}

export function canManageOwnMfa(user: {
  roles: readonly string[];
  customerId?: string | null;
}): boolean {
  return user.roles.includes('SYSTEM_ADMINISTRATOR') || Boolean(user.customerId);
}
