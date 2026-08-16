import type { AuthUser } from '@maher/types';
import type { Permission } from './catalog';
import { hasPermission } from './check';

export type AppSurface = 'admin' | 'customer' | 'employee';

export type HomePersona =
  | 'customer'
  | 'sales'
  | 'purchasing'
  | 'warehouse'
  | 'production_worker'
  | 'production_supervisor'
  | 'quality'
  | 'delivery'
  | 'accounting'
  | 'management'
  | 'admin'
  | 'generic';

function can(user: AuthUser, permission: Permission): boolean {
  return hasPermission(user.permissions, permission);
}

function canAny(user: AuthUser, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}

/** Inventory ops that compose a warehouse home — not a staff-type name. */
export const WAREHOUSE_HOME_PERMISSIONS: readonly Permission[] = [
  'inventory.read',
  'inventory.receive',
  'inventory.issue',
  'inventory.transfer',
  'inventory.count',
];

const BACK_OFFICE_HOME_PERMISSIONS: readonly Permission[] = [
  'quotation.create',
  'customer.create',
  'sales-order.create',
  'sales-order.read',
  'purchase-order.create',
  'purchase-order.read',
  'supplier.manage',
  'invoice.create',
  'payment.record',
  'catalog.manage',
  'catalog.read',
  'production-order.read',
  'user.manage',
  'role.manage',
  'report.production.read',
  'report.financial.read',
];

export type ComposedHomeKind = 'sales' | 'warehouse' | 'backoffice' | 'personal';

/**
 * Which Home body to mount from current effective permissions.
 * Never use a staff-type code here.
 */
export function resolveComposedHomeKind(user: AuthUser | null | undefined): ComposedHomeKind {
  if (!user) return 'personal';
  if (can(user, 'report.sales.read')) return 'sales';
  if (canAny(user, WAREHOUSE_HOME_PERMISSIONS)) return 'warehouse';
  if (canAny(user, BACK_OFFICE_HOME_PERMISSIONS)) return 'backoffice';
  return 'personal';
}

export function shouldFetchSalesAdminHome(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return can(user, 'report.sales.read');
}

function isCustomerIdentity(user: AuthUser): boolean {
  if (user.customerId) return true;
  if (user.roles.includes('CUSTOMER')) return true;
  return (user.rolesDetailed ?? []).some((r) => r.code === 'CUSTOMER' || r.kind === 'CUSTOMER');
}

/**
 * Which web portal this user should land on after a shared login.
 * Based on effective permissions + customer linkage — not only role name.
 */
export function resolveAppSurface(user: AuthUser): AppSurface {
  if (isCustomerIdentity(user)) return 'customer';

  const isFloor = canAny(user, [
    'production-task.update-own',
    'production-task.complete',
    'delivery.update',
    'quality-inspection.perform',
  ]);

  const isBackOffice = canAny(user, [
    'user.manage',
    'role.manage',
    'customer.create',
    'quotation.create',
    'quotation.approve',
    'purchase-order.approve',
    'purchase-order.create',
    'inventory.adjust',
    'inventory.transfer',
    'invoice.create',
    'payment.record',
    'report.sales.read',
    'report.financial.read',
    'report.production.read',
    'settings.manage',
    'audit.read',
    'ai-intake.manage',
  ]);

  if (isFloor && !isBackOffice) return 'employee';
  return 'admin';
}

/** In-app path (no locale prefix) after login for the chosen surface. */
export function resolveWebHomePath(user: AuthUser): string {
  const surface = resolveAppSurface(user);
  if (surface === 'employee') return '/dashboard';
  return '/dashboard';
}

/** Primary mobile home persona from permissions. */
export function resolveHomePersona(user: AuthUser | null | undefined): HomePersona {
  if (!user) return 'generic';
  if (isCustomerIdentity(user) && can(user, 'request.create')) return 'customer';
  if (can(user, 'user.manage') || can(user, 'role.manage')) return 'admin';
  if (canAny(user, ['report.sales.read', 'report.production.read', 'report.financial.read'])) {
    if (can(user, 'audit.read') || can(user, 'settings.manage')) return 'management';
  }
  if (canAny(user, ['invoice.create', 'payment.record', 'report.financial.read'])) return 'accounting';
  if (can(user, 'delivery.update') || can(user, 'delivery.read')) {
    if (!can(user, 'quotation.create')) return 'delivery';
  }
  if (canAny(user, ['quality-inspection.perform', 'quality-inspection.approve'])) return 'quality';
  if (can(user, 'production-order.assign') || can(user, 'production-task.update-any')) {
    return 'production_supervisor';
  }
  if (canAny(user, ['production-task.update-own', 'production-task.complete'])) {
    return 'production_worker';
  }
  if (canAny(user, WAREHOUSE_HOME_PERMISSIONS)) {
    return 'warehouse';
  }
  if (canAny(user, ['purchase-order.create', 'purchase-request.create', 'supplier.manage'])) {
    return 'purchasing';
  }
  if (canAny(user, ['quotation.create', 'customer.create', 'sales-order.create'])) return 'sales';
  return 'generic';
}

/** Expo Router href after mobile login — routes by admin / customer / employee surface. */
export function resolveMobileHomeHref(user: AuthUser): string {
  const surface = resolveAppSurface(user);
  if (surface === 'customer') return '/(app)/(customer)/(tabs)';
  if (surface === 'employee') return '/(app)/(employee)/(tabs)';
  return '/(app)/(admin)/(tabs)';
}
