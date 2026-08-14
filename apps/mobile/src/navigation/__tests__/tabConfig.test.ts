import type { AuthUser } from '@maher/types';
import { visibleTabsForUser, isTabAllowed } from '../tabConfig';

const base: AuthUser = {
  id: '1',
  username: 'test',
  email: 'a@b.c',
  name: 'Test',
  roles: [],
  permissions: [],
  preferredLanguage: 'en',
};

describe('tabConfig', () => {
  it('admin shows Home + More always and mid tabs by permission (≤5)', () => {
    const full: AuthUser = {
      ...base,
      permissions: [
        'sales-order.read',
        'inventory.read',
        'production-order.read',
        'quotation.create',
      ],
    };
    const tabs = visibleTabsForUser('admin', full).map((t) => t.name);
    expect(tabs).toEqual(['index', 'orders', 'inventory', 'production', 'more']);
    expect(tabs.length).toBeLessThanOrEqual(5);

    const limited: AuthUser = {
      ...base,
      permissions: ['quotation.create', 'customer.create'],
    };
    expect(visibleTabsForUser('admin', limited).map((t) => t.name)).toEqual(['index', 'more']);
  });

  it('customer/dealer tabs are Home Catalog Orders Account (New Order is FAB)', () => {
    const dealer: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['catalog.read', 'request.create', 'sales-order.read'],
    };
    expect(visibleTabsForUser('customer', dealer).map((t) => t.name)).toEqual([
      'index',
      'catalog',
      'orders',
      'account',
    ]);
    expect(visibleTabsForUser('customer', dealer).map((t) => t.name)).not.toContain(
      'new-order',
    );

    const browseOnly: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['catalog.read'],
    };
    expect(visibleTabsForUser('customer', browseOnly).map((t) => t.name)).toEqual([
      'index',
      'catalog',
      'account',
    ]);
  });

  it('employee/worker tabs gate tasks and notifications', () => {
    const worker: AuthUser = {
      ...base,
      permissions: [
        'production-task.read',
        'production-task.update-own',
        'notification.read',
      ],
    };
    expect(visibleTabsForUser('employee', worker).map((t) => t.name)).toEqual([
      'index',
      'tasks',
      'completed',
      'notifications',
      'profile',
    ]);

    const bare: AuthUser = {
      ...base,
      permissions: ['production-task.update-own'],
    };
    expect(visibleTabsForUser('employee', bare).map((t) => t.name)).toEqual(['index', 'profile']);
    expect(isTabAllowed('employee', 'tasks', bare)).toBe(false);
  });

  it('shows inventory tab from inventory permissions, not a staff-type switch', () => {
    const warehouse: AuthUser = {
      ...base,
      roles: ['WAREHOUSE_MANAGEMENT'],
      permissions: [
        'inventory.read',
        'inventory.receive',
        'inventory.issue',
        'inventory.transfer',
        'inventory.count',
        'warehouse.read',
        'notification.read',
        'document.read',
      ],
    };
    expect(visibleTabsForUser('admin', warehouse).map((t) => t.name)).toEqual([
      'index',
      'inventory',
      'more',
    ]);
    expect(visibleTabsForUser('admin', { ...warehouse }).map((t) => t.name)).toEqual([
      'index',
      'inventory',
      'more',
    ]);
  });

  it('Inventory Counter keeps Inventory + Count-capable tabs without Orders', () => {
    const counter: AuthUser = {
      ...base,
      permissions: ['inventory.read', 'inventory.count', 'warehouse.read'],
    };
    expect(visibleTabsForUser('admin', counter).map((t) => t.name)).toEqual([
      'index',
      'inventory',
      'more',
    ]);
  });

  it('read-only inventory still gets Inventory; staff with no business perms get Home + More', () => {
    const readOnly: AuthUser = {
      ...base,
      permissions: ['inventory.read', 'warehouse.read'],
    };
    expect(visibleTabsForUser('admin', readOnly).map((t) => t.name)).toEqual([
      'index',
      'inventory',
      'more',
    ]);

    const none: AuthUser = { ...base, permissions: ['notification.read'] };
    expect(visibleTabsForUser('admin', none).map((t) => t.name)).toEqual(['index', 'more']);
  });

  it('does not leak admin tabs onto staff, worker, or dealer snapshots', () => {
    const admin: AuthUser = {
      ...base,
      permissions: ['sales-order.read', 'inventory.read', 'production-order.read', 'user.manage'],
    };
    const staff: AuthUser = {
      ...base,
      permissions: ['inventory.read', 'inventory.receive', 'warehouse.read'],
    };
    const worker: AuthUser = {
      ...base,
      permissions: ['production-task.read', 'production-task.update-own'],
    };
    const dealer: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['catalog.read', 'request.create', 'sales-order.read'],
    };
    expect(visibleTabsForUser('admin', admin).map((t) => t.name)).toContain('orders');
    expect(visibleTabsForUser('admin', staff).map((t) => t.name)).not.toContain('orders');
    expect(visibleTabsForUser('employee', worker).map((t) => t.name)).not.toContain('inventory');
    expect(visibleTabsForUser('customer', dealer).map((t) => t.name)).not.toContain('inventory');
  });
});
