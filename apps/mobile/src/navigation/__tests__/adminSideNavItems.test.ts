import type { AuthUser } from '@maher/types';
import { ROLE_PERMISSIONS, SYSTEM_STAFF_PRESETS } from '@maher/permissions';
import { adminSideNavItems, isAdminModulePath, selectedAdminSideNavKey } from '../adminSideNavItems';

function userWith(permissions: readonly string[]): AuthUser {
  return {
    id: 'u1',
    username: 'staff',
    email: 's@b.c',
    name: 'Staff',
    roles: ['ADMIN'],
    permissions: [...permissions],
    preferredLanguage: 'en',
  };
}

describe('adminSideNavItems permission parity', () => {
  it('rail is primary tabs including More; sidebar drops More and adds overflow modules', () => {
    const admin = userWith(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR);
    const rail = adminSideNavItems(admin, 'rail');
    const side = adminSideNavItems(admin, 'sidebar');
    expect(rail.primary.map((i) => i.tabName)).toEqual([
      'index',
      'orders',
      'inventory',
      'production',
      'more',
    ]);
    expect(rail.overflow).toEqual([]);
    expect(side.primary.map((i) => i.tabName)).toEqual([
      'index',
      'orders',
      'inventory',
      'production',
    ]);
    expect(side.overflow.map((i) => i.key)).toEqual(
      expect.arrayContaining([
        'mod:products',
        'mod:dealers',
        'mod:purchasing',
        'mod:invoices',
        'mod:reports',
        'mod:scheduling',
        'mod:users',
        'mod:ai-chat',
      ]),
    );
    expect(side.overflow.some((i) => i.key === 'mod:more')).toBe(false);
  });

  it('System Admin sees users; Warehouse does not', () => {
    const admin = adminSideNavItems(userWith(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR), 'sidebar');
    const warehouse = adminSideNavItems(
      userWith(SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes),
      'sidebar',
    );
    expect(admin.overflow.some((i) => i.key === 'mod:users')).toBe(true);
    expect(warehouse.overflow.some((i) => i.key === 'mod:users')).toBe(false);
    expect(warehouse.primary.some((i) => i.tabName === 'inventory')).toBe(true);
    expect(warehouse.primary.some((i) => i.tabName === 'orders')).toBe(false);
  });

  it('Purchasing sees purchasing overflow, not invoices', () => {
    const buy = adminSideNavItems(
      userWith(SYSTEM_STAFF_PRESETS.PURCHASING.permissionCodes),
      'sidebar',
    );
    expect(buy.overflow.some((i) => i.key === 'mod:purchasing')).toBe(true);
    expect(buy.overflow.some((i) => i.key === 'mod:invoices')).toBe(false);
    expect(buy.overflow.some((i) => i.key === 'mod:users')).toBe(false);
  });

  it('Finance sees invoices, not warehouse receive modules as tabs', () => {
    const fin = adminSideNavItems(
      userWith(SYSTEM_STAFF_PRESETS.FINANCE.permissionCodes),
      'sidebar',
    );
    expect(fin.overflow.some((i) => i.key === 'mod:invoices')).toBe(true);
    expect(fin.primary.some((i) => i.tabName === 'inventory')).toBe(false);
    expect(fin.overflow.some((i) => i.key === 'mod:users')).toBe(false);
  });

  it('Production Manager sees production tab and problems, not user.manage', () => {
    const pm = adminSideNavItems(
      userWith(SYSTEM_STAFF_PRESETS.PRODUCTION_MANAGEMENT.permissionCodes),
      'sidebar',
    );
    expect(pm.primary.some((i) => i.tabName === 'production')).toBe(true);
    expect(pm.overflow.some((i) => i.key === 'mod:problems')).toBe(true);
    expect(pm.overflow.some((i) => i.key === 'mod:users')).toBe(false);
  });

  it('never invents routes that are not in tabs or overflow modules', () => {
    const admin = adminSideNavItems(userWith(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR), 'sidebar');
    for (const item of [...admin.primary, ...admin.overflow]) {
      expect(String(item.href)).toMatch(/^\/\(app\)\/\(admin\)/);
    }
  });
});

describe('selectedAdminSideNavKey', () => {
  it('prefers an overflow module over the More tab when the path is nested', () => {
    const admin = userWith(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR);
    const { primary, overflow } = adminSideNavItems(admin, 'sidebar');
    const items = [...primary, ...overflow];
    expect(selectedAdminSideNavKey(items, '/dealers/abc', 'more')).toBe('mod:dealers');
    expect(selectedAdminSideNavKey(items, '/orders', 'orders')).toBe('tab:orders');
    expect(selectedAdminSideNavKey(items, '/', 'index')).toBe('tab:index');
  });

  it('matches nested workflow paths', () => {
    expect(isAdminModulePath('/production/workflow', '/(app)/(admin)/production/workflow')).toBe(
      true,
    );
    expect(isAdminModulePath('/production/abc', '/(app)/(admin)/production/workflow')).toBe(false);
  });
});
