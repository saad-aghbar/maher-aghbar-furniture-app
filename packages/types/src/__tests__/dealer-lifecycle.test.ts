import { classifyDealerLifecycle, isConfirmReceiptVisible } from '../dealer-lifecycle';

describe('dealer-lifecycle', () => {
  it('classifies ready vs shipped from delivery status', () => {
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'READY_FOR_DELIVERY',
        deliveryStatus: null,
      }),
    ).toBe('ready');
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'READY_FOR_DELIVERY',
        deliveryStatus: 'OUT_FOR_DELIVERY',
      }),
    ).toBe('shipped');
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'DELIVERED',
        deliveryStatus: 'DELIVERED',
      }),
    ).toBe('delivered');
  });

  it('treats post-release statuses as inProduction for dealers', () => {
    expect(
      classifyDealerLifecycle({ salesOrderStatus: 'READY_FOR_PRODUCTION' }),
    ).toBe('inProduction');
    expect(
      classifyDealerLifecycle({ salesOrderStatus: 'WAITING_FOR_MATERIALS' }),
    ).toBe('inProduction');
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'DRAFT',
        productionSetupRequired: true,
      }),
    ).toBe('pending');
  });
});
