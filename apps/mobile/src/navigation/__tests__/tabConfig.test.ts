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
});
