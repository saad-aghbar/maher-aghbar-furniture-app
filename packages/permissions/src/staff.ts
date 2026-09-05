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
      'purchase-order.read',
      'notification.read',
      'document.read',
    ] as const satisfies readonly Permission[],
  },
  PRODUCTION_MANAGEMENT: {
    code: 'PRODUCTION_MANAGEMENT',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'construct-outline',
    nameEn: 'Production Management',
    nameAr: 'إدارة الإنتاج',
    nameHe: 'ניהול ייצור',
    descriptionEn: 'Shop orders, tasks, and factory floor oversight.',
    descriptionAr: 'أوامر الورشة والمهام ومتابعة أرض المصنع.',
    descriptionHe: 'הזמנות ייצור, משימות ופיקוח על הרצפה.',
    permissionCodes: [
      'production-order.read',
      'production-order.create',
      'production-order.update',
      'production-order.assign',
      'production.setup.view',
      'production.setup.edit',
      'production.setup.release',
      'production.fabric.override',
      'fabric.procurement.read',
      'production-task.read',
      'production-task.update-any',
      'production-task.complete',
      'production.material-usage.record',
      'production.workflow.read',
      'quality-inspection.read',
      'schedule.read',
      'schedule.override',
      'catalog.read',
      'inventory.cost.read',
      'notification.read',
      'document.read',
    ] as const satisfies readonly Permission[],
  },
  SCHEDULING: {
    code: 'SCHEDULING',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'calendar-outline',
    nameEn: 'Scheduling',
    nameAr: 'الجدولة',
    nameHe: 'תזמון',
    descriptionEn: 'Factory calendar, capacity, and schedule approval.',
    descriptionAr: 'تقويم المصنع والطاقة وموافقة الجداول.',
    descriptionHe: 'לוח המפעל, קיבולת ואישור לוחות זמנים.',
    permissionCodes: [
      'schedule.read',
      'schedule.manage',
      'schedule.approve',
      'schedule.capacity.read',
      'production-order.read',
      'production-task.read',
      'notification.read',
    ] as const satisfies readonly Permission[],
  },
  SALES: {
    code: 'SALES',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'briefcase-outline',
    nameEn: 'Sales',
    nameAr: 'المبيعات',
    nameHe: 'מכירות',
    descriptionEn: 'Dealers, requests, quotations, and sales orders.',
    descriptionAr: 'التجار والطلبات وعروض الأسعار وأوامر البيع.',
    descriptionHe: 'סוחרים, בקשות, הצעות מחיר והזמנות מכירה.',
    permissionCodes: [
      'customer.read',
      'customer.create',
      'customer.update',
      'contact.manage',
      'address.manage',
      'request.read',
      'request.create',
      'request.update',
      'quotation.read',
      'quotation.create',
      'quotation.update',
      'quotation.submit',
      'quotation.send',
      'sales-order.read',
      'sales-order.create',
      'sales-order.update',
      'catalog.read',
      'notification.read',
      'document.read',
    ] as const satisfies readonly Permission[],
  },
  PURCHASING: {
    code: 'PURCHASING',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'cart-outline',
    nameEn: 'Purchasing',
    nameAr: 'المشتريات',
    nameHe: 'רכש',
    descriptionEn: 'Suppliers, purchase requests, and purchase orders.',
    descriptionAr: 'الموردون وطلبات الشراء وأوامر الشراء.',
    descriptionHe: 'ספקים, בקשות רכש והזמנות רכש.',
    permissionCodes: [
      'supplier.read',
      'supplier.manage',
      'purchase-request.read',
      'purchase-request.create',
      'purchase-order.read',
      'purchase-order.create',
      'purchase-order.approve',
      'fabric.procurement.read',
      'fabric.procurement.manage',
      'supplier-invoice.read',
      'supplier-invoice.create',
      'supplier-invoice.update',
      'inventory.read',
      'inventory.receive',
      'notification.read',
    ] as const satisfies readonly Permission[],
  },
  QUALITY_CONTROL: {
    code: 'QUALITY_CONTROL',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'checkmark-circle-outline',
    nameEn: 'Quality Control',
    nameAr: 'مراقبة الجودة',
    nameHe: 'בקרת איכות',
    descriptionEn: 'Inspections, defects, and rework follow-up.',
    descriptionAr: 'الفحوصات والعيوب ومتابعة إعادة العمل.',
    descriptionHe: 'בדיקות, פגמים ומעקב תיקון.',
    permissionCodes: [
      'quality-inspection.read',
      'quality-inspection.perform',
      'quality-inspection.approve',
      'production-order.read',
      'production-task.read',
      'notification.read',
      'document.read',
    ] as const satisfies readonly Permission[],
  },
  FINANCE: {
    code: 'FINANCE',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'cash-outline',
    nameEn: 'Finance',
    nameAr: 'المالية',
    nameHe: 'כספים',
    descriptionEn: 'Invoices, payments, and dealer statements.',
    descriptionAr: 'الفواتير والدفعات وكشوف التجار.',
    descriptionHe: 'חשבוניות, תשלומים ודוחות סוחרים.',
    permissionCodes: [
      'invoice.read',
      'invoice.create',
      'invoice.update',
      'payment.read',
      'payment.record',
      'statement.read',
      'report.financial.read',
      'customer.read',
      'sales-order.read',
      'inventory.cost.read',
      'notification.read',
    ] as const satisfies readonly Permission[],
  },
  DELIVERY_OPERATIONS: {
    code: 'DELIVERY_OPERATIONS',
    kind: 'STAFF' as const,
    isSystem: true,
    isActive: true,
    iconKey: 'car-outline',
    nameEn: 'Delivery Operations',
    nameAr: 'عمليات التسليم',
    nameHe: 'תפעול משלוחים',
    descriptionEn: 'Outbound deliveries and driver assignment.',
    descriptionAr: 'التسليمات الصادرة وتعيين السائقين.',
    descriptionHe: 'משלוחים יוצאים ושיוך נהגים.',
    permissionCodes: [
      'delivery.read',
      'delivery.update',
      'sales-order.read',
      'production-order.read',
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
