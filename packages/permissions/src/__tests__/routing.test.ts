import {
  resolveAppSurface,
  resolveComposedHomeKind,
  resolveHomePersona,
  resolveMobileHomeHref,
  resolveWebHomePath,
  shouldFetchSalesAdminHome,
  shouldFetchWorkerQueue,
} from '../routing';
import { can } from '../access';
import type { AuthUser } from '@maher/types';

const base: AuthUser = {
  id: '1',
  username: 'test',
  email: 'a@b.c',
  name: 'Test',
  roles: [],
  permissions: [],
  preferredLanguage: 'en',
};

const warehouseManagerPerms = [
  'inventory.read',
  'inventory.receive',
  'inventory.issue',
  'inventory.transfer',
  'inventory.count',
  'warehouse.read',
  'notification.read',
  'document.read',
] as const;

describe('post-login routing', () => {
  it('sends customers to the customer portal', () => {
    const user: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['request.create', 'quotation.read'],
    };
    expect(resolveAppSurface(user)).toBe('customer');
    expect(resolveWebHomePath(user)).toBe('/dashboard');
    expect(resolveHomePersona(user)).toBe('customer');
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(customer)/(tabs)');
  });

  it('sends CUSTOMER-role users to the customer portal even without customerId', () => {
    const user: AuthUser = {
      ...base,
      roles: ['CUSTOMER'],
      permissions: ['request.create', 'quotation.read', 'ai-intake.manage'],
    };
    expect(resolveAppSurface(user)).toBe('customer');
    expect(resolveHomePersona(user)).toBe('customer');
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(customer)/(tabs)');
  });

  it('sends production workers to the employee portal', () => {
    const user: AuthUser = {
      ...base,
      permissions: [
        'production-task.read',
        'production-task.update-own',
        'production-task.complete',
        'notification.read',
      ],
    };
    expect(resolveAppSurface(user)).toBe('employee');
    expect(resolveWebHomePath(user)).toBe('/dashboard');
    expect(resolveHomePersona(user)).toBe('production_worker');
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(employee)/(tabs)');
    expect(shouldFetchWorkerQueue(user)).toBe(true);
  });

  it('does not fetch the worker queue on admin or dealer surfaces', () => {
    const admin: AuthUser = {
      ...base,
      permissions: [
        'production-task.read',
        'production-order.read',
        'quotation.create',
        'inventory.adjust',
      ],
    };
    const dealer: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['production-task.read', 'request.create', 'sales-order.read'],
    };
    expect(resolveAppSurface(admin)).toBe('admin');
    expect(shouldFetchWorkerQueue(admin)).toBe(false);
    expect(resolveAppSurface(dealer)).toBe('customer');
    expect(shouldFetchWorkerQueue(dealer)).toBe(false);
    expect(shouldFetchWorkerQueue(null)).toBe(false);
  });

  it('does not fetch the worker queue without production-task.read', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['production-task.update-own', 'production-task.complete'],
    };
    expect(resolveAppSurface(user)).toBe('employee');
    expect(shouldFetchWorkerQueue(user)).toBe(false);
  });

  it('sends warehouse staff to the admin portal with a warehouse persona', () => {
    const user: AuthUser = {
      ...base,
      roles: ['WAREHOUSE_MANAGEMENT'],
      permissions: [...warehouseManagerPerms],
    };
    expect(resolveAppSurface(user)).toBe('admin');
    expect(resolveHomePersona(user)).toBe('warehouse');
    expect(resolveComposedHomeKind(user)).toBe('warehouse');
    expect(shouldFetchSalesAdminHome(user)).toBe(false);
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(admin)/(tabs)');
    expect(resolveWebHomePath(user)).toBe('/dashboard');
  });

  it('treats inventory.read-only staff as warehouse, not generic sales home', () => {
    const user: AuthUser = {
      ...base,
      roles: ['INVENTORY_ASSISTANT'],
      permissions: ['inventory.read', 'warehouse.read'],
    };
    expect(resolveAppSurface(user)).toBe('admin');
    expect(resolveHomePersona(user)).toBe('warehouse');
    expect(resolveComposedHomeKind(user)).toBe('warehouse');
    expect(shouldFetchSalesAdminHome(user)).toBe(false);
  });

  it('composes an inventory-counter home without receive/transfer', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['inventory.read', 'inventory.count', 'warehouse.read'],
    };
    expect(resolveHomePersona(user)).toBe('warehouse');
    expect(resolveComposedHomeKind(user)).toBe('warehouse');
    expect(can(user, 'inventory.receive')).toBe(false);
    expect(can(user, 'inventory.transfer')).toBe(false);
    expect(can(user, 'inventory.count')).toBe(true);
  });

  it('uses a personal home when staff have no business permissions', () => {
    const user: AuthUser = {
      ...base,
      roles: ['EMPTY_STAFF'],
      permissions: ['notification.read', 'document.read'],
    };
    expect(resolveAppSurface(user)).toBe('admin');
    expect(resolveComposedHomeKind(user)).toBe('personal');
    expect(shouldFetchSalesAdminHome(user)).toBe(false);
  });

  it('keeps sales home when report.sales.read is granted', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['report.sales.read', 'inventory.read'],
    };
    expect(resolveComposedHomeKind(user)).toBe('sales');
    expect(shouldFetchSalesAdminHome(user)).toBe(true);
  });

  it('hides transfer after the staff type loses inventory.transfer', () => {
    const before: AuthUser = { ...base, permissions: [...warehouseManagerPerms] };
    const after: AuthUser = {
      ...base,
      permissions: warehouseManagerPerms.filter((p) => p !== 'inventory.transfer'),
    };
    expect(can(before, 'inventory.transfer')).toBe(true);
    expect(can(after, 'inventory.transfer')).toBe(false);
    expect(resolveComposedHomeKind(after)).toBe('warehouse');
    expect(shouldFetchSalesAdminHome(after)).toBe(false);
  });

  it('sends sales/admin to the admin portal', () => {
    const user: AuthUser = {
      ...base,
      permissions: ['quotation.create', 'customer.create', 'sales-order.create'],
    };
    expect(resolveAppSurface(user)).toBe('admin');
    expect(resolveWebHomePath(user)).toBe('/dashboard');
    expect(resolveHomePersona(user)).toBe('sales');
    expect(resolveMobileHomeHref(user)).toBe('/(app)/(admin)/(tabs)');
  });
});
