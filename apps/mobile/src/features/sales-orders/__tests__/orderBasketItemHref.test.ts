import { orderBasketItemHref } from '../orderBasketItemHref';

describe('orderBasketItemHref', () => {
  it('opens the line plan while Preparing', () => {
    expect(
      orderBasketItemHref({
        salesOrderId: 'so-1',
        lineId: 'sol-9',
        lifecycle: 'preparing',
      }),
    ).toBe('/(app)/(admin)/orders/so-1/production-plan?lineId=sol-9');
  });

  it('opens the linked production order in production', () => {
    expect(
      orderBasketItemHref({
        salesOrderId: 'so-1',
        lineId: 'sol-9',
        lifecycle: 'in_production',
        productionOrderId: 'po-4',
      }),
    ).toBe('/(app)/(admin)/production/po-4');
  });

  it('opens the sales order when a later lane has no PO', () => {
    expect(
      orderBasketItemHref({
        salesOrderId: 'so-1',
        lineId: 'sol-9',
        lifecycle: 'ready_to_ship',
      }),
    ).toBe('/(app)/(admin)/orders/so-1');
  });
});
