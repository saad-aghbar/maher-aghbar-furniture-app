import {
  indexDeliveryIssueLeftAt,
  lotOverlapsHistoryWindow,
  resolveLotLeftAt,
} from './finished-lot-presence';

describe('finished-lot presence window', () => {
  const fromStart = new Date('2026-08-01T00:00:00.000Z');
  const toEnd = new Date('2026-08-31T23:59:59.999Z');

  it('keeps lots still in warehouse that entered before the window end', () => {
    expect(
      lotOverlapsHistoryWindow(new Date('2026-07-01T00:00:00.000Z'), null, fromStart, toEnd),
    ).toBe(true);
  });

  it('drops lots that left before the window start', () => {
    expect(
      lotOverlapsHistoryWindow(
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-07-15T00:00:00.000Z'),
        fromStart,
        toEnd,
      ),
    ).toBe(false);
  });

  it('resolves leftAt from the latest delivery-issue tx', () => {
    const maps = indexDeliveryIssueLeftAt([
      {
        referenceId: 'del-1',
        inventoryItemId: 'item-1',
        createdAt: new Date('2026-08-10T00:00:00.000Z'),
      },
      {
        referenceId: 'del-1',
        inventoryItemId: 'item-1',
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
      },
    ]);
    expect(
      resolveLotLeftAt(
        {
          status: 'DELIVERED',
          inventoryItemId: 'item-1',
          productionOrderId: 'po-1',
          salesOrder: { deliveries: [{ id: 'del-1' }] },
        },
        maps.leftAtByDelivery,
        maps.leftAtByItemPo,
      )?.toISOString(),
    ).toBe('2026-08-20T00:00:00.000Z');
  });
});
