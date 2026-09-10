import { productionHubOrderHref } from '../productionHubOrderHref';

describe('productionHubOrderHref', () => {
  it('opens the sales-order plan for unreleased work with a sales order', () => {
    expect(
      productionHubOrderHref({
        id: 'po-1',
        salesOrderId: 'so-9',
        releasedToFactoryAt: null,
        originType: 'SALES_ORDER',
      }),
    ).toBe('/(app)/(admin)/orders/so-9/production-plan');
  });

  it('opens the production plan for unreleased return work without a sales order', () => {
    expect(
      productionHubOrderHref({
        id: 'po-ret',
        salesOrderId: null,
        releasedToFactoryAt: null,
        originType: 'RETURN_WORK',
      }),
    ).toBe('/(app)/(admin)/production/po-ret/plan');
  });

  it('opens the production order for in-production work even if a sales order exists', () => {
    expect(
      productionHubOrderHref({
        id: 'po-floor',
        salesOrderId: 'so-9',
        releasedToFactoryAt: '2026-09-01T08:00:00.000Z',
        originType: 'SALES_ORDER',
      }),
    ).toBe('/(app)/(admin)/production/po-floor');
  });

  it('ignores selected-lane context — released replacement still opens the order', () => {
    expect(
      productionHubOrderHref({
        id: 'po-rep',
        salesOrderId: 'so-old',
        releasedToFactoryAt: '2026-09-02T00:00:00.000Z',
        originType: 'REPLACEMENT',
      }),
    ).toBe('/(app)/(admin)/production/po-rep');
  });
});
