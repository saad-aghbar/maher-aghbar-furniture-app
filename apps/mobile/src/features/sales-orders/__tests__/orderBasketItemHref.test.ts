import { orderBasketDetailsHref, orderBasketItemHref } from '../orderBasketItemHref';

describe('orderBasketItemHref', () => {
  it('Details opens the line chooser even for a one-item order', () => {
    expect(orderBasketDetailsHref('so-1')).toBe(
      '/(app)/(admin)/orders/so-1/production-plan',
    );
  });
  it('opens the line chooser when the order has one item', () => {
    expect(
      orderBasketItemHref({
        salesOrderId: 'so-1',
        lineId: 'sol-9',
        lifecycle: 'preparing',
        itemCount: 1,
        productionOrderId: 'po-4',
      }),
    ).toBe('/(app)/(admin)/orders/so-1/production-plan');
    expect(
      orderBasketItemHref({
        salesOrderId: 'so-1',
        lineId: 'sol-9',
        lifecycle: 'in_production',
        itemCount: 1,
        productionOrderId: 'po-4',
      }),
    ).toBe('/(app)/(admin)/orders/so-1/production-plan');
  });

  it('opens the line plan while Preparing a multi-item order', () => {
    expect(
      orderBasketItemHref({
        salesOrderId: 'so-1',
        lineId: 'sol-9',
        lifecycle: 'preparing',
        itemCount: 3,
      }),
    ).toBe('/(app)/(admin)/orders/so-1/production-plan?lineId=sol-9');
  });

  it('opens the linked production order in production for a multi-item row', () => {
    expect(
      orderBasketItemHref({
        salesOrderId: 'so-1',
        lineId: 'sol-9',
        lifecycle: 'in_production',
        itemCount: 2,
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
        itemCount: 2,
      }),
    ).toBe('/(app)/(admin)/orders/so-1');
  });
});
