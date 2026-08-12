import { localizedName } from '@maher/i18n';
import type { UserDepartment, UserRoleRef, UserRow } from '@/api/modules/users';

export function userDisplayName(user: Pick<UserRow, 'firstName' | 'lastName' | 'username'>): string {
  const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return full || user.username?.trim() || '—';
}

export function userRoleLabels(user: UserRow, locale: string): string {
  const roles = user.roles ?? [];
  if (!roles.length) return '—';
  return roles
    .map(({ role }) => localizedRoleName(role, locale))
    .filter(Boolean)
    .join(', ');
}

export function localizedRoleName(role: UserRoleRef, locale: string): string {
  return localizedName(locale, role, role.code);
}

export function localizedDepartmentName(
  department: UserDepartment | null | undefined,
  locale: string,
): string {
  if (!department) return '—';
  return localizedName(locale, department, department.code);
}

export function primaryRoleCode(user: UserRow): string | undefined {
  return user.roles?.[0]?.role.code;
}

export function isCustomerUser(user: UserRow): boolean {
  return (user.roles ?? []).some((r) => r.role.code === 'CUSTOMER');
}

/** Roles that do not use department on create/edit/list. */
const NO_DEPARTMENT_ROLE_CODES = new Set([
  'CUSTOMER',
  'PRODUCTION_WORKER',
  'SYSTEM_ADMINISTRATOR',
]);

export function roleUsesDepartment(roleCode: string | undefined | null): boolean {
  if (!roleCode) return false;
  return !NO_DEPARTMENT_ROLE_CODES.has(roleCode);
}

export function userShowsDepartment(user: UserRow): boolean {
  const roles = user.roles ?? [];
  if (!roles.length) return false;
  return roles.some((r) => roleUsesDepartment(r.role.code));
}
