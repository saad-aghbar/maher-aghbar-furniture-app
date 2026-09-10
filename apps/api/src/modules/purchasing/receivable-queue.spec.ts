import { ROLE_PERMISSIONS, SYSTEM_STAFF_PRESETS, hasPermission } from '@maher/permissions';
import {
  groupReceiptLinesByWarehouse,
  mapReceivableLines,
  receiptIdempotencyKey,
  RECEIVABLE_PO_STATUSES,
} from './receivable-queue';

describe('receivable queue helpers', () => {
  it('drops fully received lines and reports remaining', () => {
    const received = new Map([['oak', 8]]);
    const lines = mapReceivableLines(
      [
        { id: 'l1', inventoryItemId: 'oak', description: 'Oak', quantity: 10, category: 'WOOD' },
        { id: 'l2', inventoryItemId: 'foam', description: 'Foam', quantity: 4, receivedQty: 4, category: 'FOAM' },
        {
          id: 'l3',
          inventoryItemId: 'vel',
          description: 'Velvet',
          quantity: 6,
          category: 'FABRIC',
          fabricProcurementId: 'fp-1',
        },
      ],
      received,
    );
    expect(lines.map((l) => l.id)).toEqual(['l1', 'l3']);
    expect(lines[0]?.remainingQty).toBe(2);
    expect(lines[1]?.isFabric).toBe(true);
  });

  it('groups receipt lines by warehouse with a fallback', () => {
    const groups = groupReceiptLinesByWarehouse(
      [
        { warehouseId: 'wh-a', receivedQty: 2 },
        { warehouseId: 'wh-b', receivedQty: 1 },
        { warehouseId: null, receivedQty: 3 },
        { warehouseId: 'wh-a', receivedQty: 0, rejectedQty: 0 },
      ],
      'wh-default',
    );
    expect([...groups.keys()]).toEqual(['wh-a', 'wh-b', 'wh-default']);
    expect(groups.get('wh-a')).toHaveLength(1);
  });

  it('scopes idempotency keys per warehouse', () => {
    expect(receiptIdempotencyKey('recv-1', 'wh-a')).toBe('recv-1:wh-a');
    expect(receiptIdempotencyKey(null, 'wh-a')).toBeNull();
  });

  it('receivable statuses exclude received and draft', () => {
    expect(RECEIVABLE_PO_STATUSES).toEqual(['SENT', 'PARTIALLY_RECEIVED']);
  });

  it('denies dealer and worker roles from inventory.receive', () => {
    expect(hasPermission(ROLE_PERMISSIONS.CUSTOMER, 'inventory.receive')).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.PRODUCTION_WORKER, 'inventory.receive')).toBe(false);
    expect(
      hasPermission([...SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes], 'inventory.receive'),
    ).toBe(true);
  });
});
