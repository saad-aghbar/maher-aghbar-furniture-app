import { productionOrderIdForLineId } from '../productionOrderIdForLine';

describe('productionOrderIdForLineId', () => {
  const pos = [
    { id: 'po-a', salesOrderLineId: 'so-line-a' },
    { id: 'po-b', salesOrderLineId: 'so-line-b' },
    { id: 'po-c', salesOrderLineId: 'so-line-c' },
  ];
  const setupLines = [
    { id: 'setup-a', salesOrderLineId: 'so-line-a' },
    { id: 'setup-b', salesOrderLineId: 'so-line-b' },
  ];

  it('maps a sales-order line id to its production order', () => {
    expect(
      productionOrderIdForLineId({
        lineId: 'so-line-b',
        productionOrders: pos,
        fallbackId: 'po-a',
      }),
    ).toBe('po-b');
  });

  it('maps a setup line id to its production order', () => {
    expect(
      productionOrderIdForLineId({
        lineId: 'setup-b',
        productionOrders: pos,
        setupLines,
        fallbackId: 'po-a',
      }),
    ).toBe('po-b');
  });

  it('does not silently open productionOrders[0] when a later line is requested', () => {
    expect(
      productionOrderIdForLineId({
        lineId: 'so-line-c',
        productionOrders: pos,
        fallbackId: pos[0]!.id,
      }),
    ).toBe('po-c');
    expect(pos[0]!.id).toBe('po-a');
  });
});
