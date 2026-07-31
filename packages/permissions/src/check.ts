import type { Permission } from './catalog';

export function hasPermission(
  userPermissions: string[],
  required: Permission | Permission[],
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((permission) => userPermissions.includes(permission));
}
