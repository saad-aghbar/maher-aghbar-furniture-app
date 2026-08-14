import { PERMISSIONS, type Permission } from './catalog';

export const ROLE_KINDS = ['CUSTOMER', 'PRODUCTION_WORKER', 'STAFF', 'ADMIN'] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export const IDENTITY_ROLE_CODES = [
  'CUSTOMER',
  'PRODUCTION_WORKER',
  'SYSTEM_ADMINISTRATOR',
] as const;
export type IdentityRoleCode = (typeof IDENTITY_ROLE_CODES)[number];

export type EmployeeType = 'WORKER' | 'STAFF';

export const SYSTEM_STAFF_PRESETS = {
  WAREHOUSE_MANAGEMENT: {
    code: 'WAREHOUSE_MANAGEMENT',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'cube-outline',
    nameEn: 'Warehouse Management',
    nameAr: 'إدارة المستودعات',
    nameHe: 'ניהול מחסנים',
    descriptionEn: 'Inventory, warehouses and stock operations.',
    descriptionAr: 'المخزون والمستودعات وعمليات المواد.',
    descriptionHe: 'מלאי, מחסנים ותפעול מלאי.',
    permissionCodes: [
      'inventory.read',
      'warehouse.read',
      'inventory.receive',
      'inventory.issue',
      'inventory.transfer',
      'inventory.count',
      'notification.read',
      'document.read',
    ] as const satisfies readonly Permission[],
  },
} as const;

export type SystemStaffPresetCode = keyof typeof SYSTEM_STAFF_PRESETS;

export function identityRoleCodeForKind(kind: RoleKind | string | null | undefined): IdentityRoleCode | null {
  if (kind === 'CUSTOMER') return 'CUSTOMER';
  if (kind === 'ADMIN') return 'SYSTEM_ADMINISTRATOR';
  if (kind === 'PRODUCTION_WORKER' || kind === 'STAFF') return 'PRODUCTION_WORKER';
  return null;
}

export function employeeTypeFromKind(kind: RoleKind | string | null | undefined): EmployeeType | null {
  if (kind === 'PRODUCTION_WORKER') return 'WORKER';
  if (kind === 'STAFF') return 'STAFF';
  return null;
}

export function isIdentityRoleCode(code: string | null | undefined): code is IdentityRoleCode {
  return IDENTITY_ROLE_CODES.includes(code as IdentityRoleCode);
}

export function isStaffRoleKind(kind: RoleKind | string | null | undefined): boolean {
  return kind === 'STAFF';
}

export function roleUsesDepartment(kind: RoleKind | string | null | undefined): boolean {
  return kind !== 'CUSTOMER' && kind !== 'PRODUCTION_WORKER' && kind !== 'ADMIN' && kind !== 'STAFF';
}

export function generateStaffTypeCode(nameEn: string, existingCodes: readonly string[] = []): string {
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  const base =
    nameEn
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'STAFF';
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${Date.now().toString(36).toUpperCase()}`;
}

export type UserIdentityForm = {
  identityRoleCode: IdentityRoleCode | '';
  employeeType: EmployeeType | '';
  staffTypeId: string;
  stageDefinitionIds: string[];
};

export function emptyUserIdentityForm(): UserIdentityForm {
  return {
    identityRoleCode: '',
    employeeType: '',
    staffTypeId: '',
    stageDefinitionIds: [],
  };
}

export function hydrateUserIdentityForm(role: {
  id: string;
  code: string;
  kind?: string | null;
}): UserIdentityForm {
  const kind = role.kind ?? (isIdentityRoleCode(role.code) ? roleKindFromIdentityCode(role.code) : 'STAFF');
  const identityRoleCode = identityRoleCodeForKind(kind) ?? '';
  const employeeType = employeeTypeFromKind(kind) ?? '';
  return {
    identityRoleCode,
    employeeType,
    staffTypeId: kind === 'STAFF' ? role.id : '',
    stageDefinitionIds: [],
  };
}

export function roleKindFromIdentityCode(code: IdentityRoleCode): RoleKind {
  if (code === 'CUSTOMER') return 'CUSTOMER';
  if (code === 'SYSTEM_ADMINISTRATOR') return 'ADMIN';
  return 'PRODUCTION_WORKER';
}

export function applyIdentityChange(
  form: UserIdentityForm,
  identityRoleCode: IdentityRoleCode,
): UserIdentityForm {
  if (identityRoleCode === 'PRODUCTION_WORKER') {
    return {
      ...form,
      identityRoleCode,
      employeeType: form.employeeType || 'WORKER',
      staffTypeId: form.employeeType === 'STAFF' ? form.staffTypeId : '',
      stageDefinitionIds: form.employeeType === 'STAFF' ? [] : form.stageDefinitionIds,
    };
  }
  return {
    ...form,
    identityRoleCode,
    employeeType: '',
    staffTypeId: '',
    stageDefinitionIds: [],
  };
}

export function applyEmployeeTypeChange(
  form: UserIdentityForm,
  employeeType: EmployeeType,
): UserIdentityForm {
  if (employeeType === 'WORKER') {
    return { ...form, employeeType, staffTypeId: '', stageDefinitionIds: form.stageDefinitionIds };
  }
  return { ...form, employeeType, staffTypeId: form.staffTypeId, stageDefinitionIds: [] };
}

export function submittedRoleId(
  form: UserIdentityForm,
  roles: ReadonlyArray<{ id: string; code: string; kind?: string | null }>,
): string | null {
  if (!form.identityRoleCode) return null;
  if (form.identityRoleCode !== 'PRODUCTION_WORKER') {
    return roles.find((r) => r.code === form.identityRoleCode)?.id ?? null;
  }
  if (form.employeeType === 'STAFF') {
    return form.staffTypeId || null;
  }
  return roles.find((r) => r.code === 'PRODUCTION_WORKER')?.id ?? null;
}

export function submittedStageDefinitionIds(form: UserIdentityForm): string[] {
  if (form.identityRoleCode === 'PRODUCTION_WORKER' && form.employeeType === 'WORKER') {
    return form.stageDefinitionIds;
  }
  return [];
}

export function assertKnownPermissionCodes(codes: readonly string[]): Permission[] {
  const known = new Set<string>(PERMISSIONS);
  const invalid = codes.filter((code) => !known.has(code));
  if (invalid.length) {
    throw new Error(`INVALID_PERMISSIONS:${invalid.join(',')}`);
  }
  return codes as Permission[];
}
