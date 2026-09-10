import { finishedLotMatchesOrderId } from '../finishedOrderDetailMatch';

describe('finishedLotMatchesOrderId', () => {
  it('matches a sales-order group', () => {
    expect(
      finishedLotMatchesOrderId(
        { salesOrder: { id: 'so-1', number: 'SO-1' }, salesOrderNumber: 'SO-1' },
        'so-1',
      ),
    ).toBe(true);
  });

  it('matches a return-work group keyed by production order', () => {
    expect(
      finishedLotMatchesOrderId(
        {
          salesOrder: null,
          salesOrderNumber: null,
          productionOrder: { id: 'rw-1', number: 'RW-2026-0017' },
          productionOrderNumber: 'RW-2026-0017',
        },
        'rw-1',
      ),
    ).toBe(true);
    expect(
      finishedLotMatchesOrderId(
        {
          productionOrder: { id: 'rw-1', number: 'RW-2026-0017' },
          productionOrderNumber: 'RW-2026-0017',
        },
        'RW-2026-0017',
      ),
    ).toBe(true);
  });
});
