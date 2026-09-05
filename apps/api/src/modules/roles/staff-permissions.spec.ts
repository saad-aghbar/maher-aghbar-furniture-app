import { ROLE_PERMISSIONS, SYSTEM_STAFF_PRESETS } from '@maher/permissions';
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

  it('warehouse staff can read inventory images but cannot PATCH them', () => {
    expect(hasPermission(warehouse, 'inventory.read')).toBe(true);
    expect(hasPermission(warehouse, 'inventory.adjust')).toBe(false);
  });

  it('system administrator can adjust inventory including imageUrl', () => {
    expect(hasPermission(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR, 'inventory.adjust')).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR, 'inventory.read')).toBe(true);
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

  it('WAREHOUSE_MANAGEMENT pack can receive and read purchase orders (Piece 6)', () => {
    const pack = [...SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes];
    expect(hasPermission(pack, 'inventory.receive')).toBe(true);
    expect(hasPermission(pack, 'purchase-order.read')).toBe(true);
  });

  it('PURCHASING pack includes fabric procurement', () => {
    const pack = [...SYSTEM_STAFF_PRESETS.PURCHASING.permissionCodes];
    expect(hasPermission(pack, 'fabric.procurement.read')).toBe(true);
    expect(hasPermission(pack, 'fabric.procurement.manage')).toBe(true);
    expect(hasPermission(pack, 'purchase-order.read')).toBe(true);
    expect(hasPermission(pack, 'inventory.receive')).toBe(true);
  });

  it('PRODUCTION_MANAGEMENT can read fabric tracker and override holds', () => {
    const pack = [...SYSTEM_STAFF_PRESETS.PRODUCTION_MANAGEMENT.permissionCodes];
    expect(hasPermission(pack, 'fabric.procurement.read')).toBe(true);
    expect(hasPermission(pack, 'production.fabric.override')).toBe(true);
    expect(hasPermission(pack, 'fabric.procurement.manage')).toBe(false);
  });

  it('dealers and workers are denied purchase receive and purchase-order packs', () => {
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'purchase-order.read')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'inventory.receive')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.PRODUCTION_WORKER, 'purchase-order.read')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.PRODUCTION_WORKER, 'inventory.receive')).toBe(false);
  });

  it('keeps full access for system administrators except dealer accept', () => {
    expect(hasPermission(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR, 'user.manage')).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR, 'inventory.receive')).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR, 'quotation.accept')).toBe(false);
  });
});
