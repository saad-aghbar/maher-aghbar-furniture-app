import { ROLE_PERMISSIONS } from '@maher/permissions';
import { hasPermission } from '@maher/permissions';

describe('staff vs identity permission isolation', () => {
  const warehouse = [
    'inventory.read',
    'warehouse.read',
    'inventory.receive',
    'inventory.issue',
    'inventory.transfer',
    'inventory.count',
    'notification.read',
    'document.read',
  ];

  it('allows warehouse staff inventory operations', () => {
    expect(hasPermission(warehouse, 'inventory.read')).toBe(true);
    expect(hasPermission(warehouse, 'inventory.receive')).toBe(true);
    expect(hasPermission(warehouse, 'inventory.transfer')).toBe(true);
    expect(hasPermission(warehouse, 'inventory.count')).toBe(true);
    expect(hasPermission(warehouse, 'warehouse.read')).toBe(true);
  });

  it('denies warehouse staff admin and production-setup capabilities', () => {
    expect(hasPermission(warehouse, 'user.manage')).toBe(false);
    expect(hasPermission(warehouse, 'catalog.manage')).toBe(false);
    expect(hasPermission(warehouse, 'settings.manage')).toBe(false);
    expect(hasPermission(warehouse, 'role.manage')).toBe(false);
  });

  it('does not grant warehouse ops to workers or dealers', () => {
    expect(hasPermission(ROLE_PERMISSIONS.PRODUCTION_WORKER, 'inventory.receive')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'inventory.transfer')).toBe(false);
  });

  it('keeps full access for system administrators', () => {
    expect(hasPermission(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR, 'user.manage')).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR, 'inventory.receive')).toBe(true);
  });
});
