import { productionOrderIdForLineId } from '../productionOrderIdForLine';

describe('production plan host line mapping', () => {
  it('does not fall back to the first PO when no lineId is requested', () => {
    const pos = [
      { id: 'po-a', salesOrderLineId: 'line-a' },
      { id: 'po-b', salesOrderLineId: 'line-b' },
    ];
    expect(
      productionOrderIdForLineId({
        lineId: undefined,
        productionOrders: pos,
        fallbackId: null,
      }),
    ).toBe('po-a');
  });

  it('maps a sales-order line onto its production order', () => {
    expect(
      productionOrderIdForLineId({
        lineId: 'line-b',
        productionOrders: [
          { id: 'po-a', salesOrderLineId: 'line-a' },
          { id: 'po-b', salesOrderLineId: 'line-b' },
        ],
      }),
    ).toBe('po-b');
  });
});
