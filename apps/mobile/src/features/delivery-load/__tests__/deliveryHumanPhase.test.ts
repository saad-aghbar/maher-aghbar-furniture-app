import {
  selectDealerDeliveryPhase,
  selectDeliveryHumanPhase,
} from '../deliveryHumanPhase';

describe('selectDeliveryHumanPhase', () => {
  it('maps Planned / Ready / Shipped / Delivered', () => {
    expect(selectDeliveryHumanPhase({ status: 'PLANNED' }).phase).toBe('planned');
    expect(selectDeliveryHumanPhase({ status: 'READY' }).phase).toBe('ready');
    expect(selectDeliveryHumanPhase({ status: 'OUT_FOR_DELIVERY' }).phase).toBe('shipped');
    expect(selectDeliveryHumanPhase({ status: 'DELIVERED' }).phase).toBe('delivered');
  });

  it('surfaces Attention + WHY when load incomplete', () => {
    const next = selectDeliveryHumanPhase({
      status: 'READY',
      loaded: 1,
      total: 3,
    });
    expect(next.phase).toBe('attention');
    expect(next.whyKey).toBe('mobile.deliveryLoad.attentionLoadIncomplete');
  });

  it('surfaces Attention when ready to depart', () => {
    const next = selectDeliveryHumanPhase({
      status: 'READY',
      loaded: 3,
      total: 3,
      canDepart: true,
    });
    expect(next.phase).toBe('attention');
    expect(next.whyKey).toBe('mobile.deliveryLoad.attentionAwaitingDepart');
  });
});

describe('selectDealerDeliveryPhase', () => {
  it('only exposes Shipped / Delivered', () => {
    expect(selectDealerDeliveryPhase('OUT_FOR_DELIVERY').phase).toBe('shipped');
    expect(selectDealerDeliveryPhase('DELIVERED').phase).toBe('delivered');
    expect(selectDealerDeliveryPhase('PLANNED').phase).toBe('shipped');
  });
});
