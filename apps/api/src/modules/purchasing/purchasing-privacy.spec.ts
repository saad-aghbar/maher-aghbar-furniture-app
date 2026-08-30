import { ROLE_PERMISSIONS, SYSTEM_STAFF_PRESETS, hasPermission } from '@maher/permissions';

/**
 * Piece 6 — purchase price / receive privacy.
 * Dealers & workers must not read PO costs or post GRNs unless packs explicitly grant.
 */
describe('Piece 6 purchasing privacy', () => {
  it('dealers cannot read purchase orders or receive goods', () => {
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'purchase-order.read')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'purchase-order.create')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'inventory.receive')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'supplier.read')).toBe(false);
  });

  it('workers cannot read purchase prices or receive by default', () => {
    expect(hasPermission(ROLE_PERMISSIONS.PRODUCTION_WORKER, 'purchase-order.read')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.PRODUCTION_WORKER, 'inventory.receive')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.PRODUCTION_WORKER, 'inventory.cost.read')).toBe(false);
  });

  it('purchasing staff can receive and read POs', () => {
    const pack = [...SYSTEM_STAFF_PRESETS.PURCHASING.permissionCodes];
    expect(hasPermission(pack, 'purchase-order.read')).toBe(true);
    expect(hasPermission(pack, 'inventory.receive')).toBe(true);
  });

  it('warehouse management can read POs to receive against them', () => {
    const pack = [...SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes];
    expect(hasPermission(pack, 'purchase-order.read')).toBe(true);
    expect(hasPermission(pack, 'inventory.receive')).toBe(true);
  });
});
