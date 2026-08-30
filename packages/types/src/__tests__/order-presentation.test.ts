import {
  classifyManufacturingComplexity,
  buildOrderLineSpecSnapshot,
  manufacturingComplexityDisplayKey,
} from '../manufacturing-complexity';
import {
  mapOrderPresentation,
  requestStatusesForGroup,
  appendReviewHistory,
} from '../order-presentation';
import { classifyDealerLifecycle } from '../dealer-lifecycle';

describe('classifyManufacturingComplexity', () => {
  it('returns CUSTOM when no productId', () => {
    expect(classifyManufacturingComplexity({ productId: null })).toBe('CUSTOM');
    expect(classifyManufacturingComplexity({})).toBe('CUSTOM');
  });

  it('returns STANDARD for catalog product with no mods', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        width: 100,
        catalog: { width: 100, height: 80, depth: 50 },
      }),
    ).toBe('STANDARD');
  });

  it('returns MODIFIED when dimensions differ from catalog', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        width: 120,
        catalog: { width: 100 },
      }),
    ).toBe('MODIFIED');
  });

  it('returns MODIFIED when fabric is requested', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        fabricType: 'Velvet',
        fabricColor: 'Navy',
      }),
    ).toBe('MODIFIED');
  });

  it('does not require a Product row — classification is pure', () => {
    const before = { id: 'p1', width: 100, bomDefaults: { x: 1 } };
    classifyManufacturingComplexity({
      productId: 'p1',
      width: 110,
      catalog: { width: 100 },
    });
    expect(before).toEqual({ id: 'p1', width: 100, bomDefaults: { x: 1 } });
  });
});

describe('buildOrderLineSpecSnapshot', () => {
  it('captures catalog vs requested dims and complexity', () => {
    const snap = buildOrderLineSpecSnapshot({
      productId: 'p1',
      productName: 'Sofa',
      quantity: 2,
      width: 200,
      catalog: { width: 180, height: 90 },
      fabricType: 'Linen',
      fabricColor: 'Sand',
    });
    expect(snap.manufacturingComplexity).toBe('MODIFIED');
    expect(snap.catalogDimensions?.width).toBe(180);
    expect(snap.requestedDimensions?.width).toBe(200);
    expect(snap.fabric?.type).toBe('Linen');
  });
});

describe('manufacturingComplexityDisplayKey', () => {
  it('maps MODIFIED to customized', () => {
    expect(manufacturingComplexityDisplayKey('MODIFIED')).toBe('customized');
    expect(manufacturingComplexityDisplayKey('STANDARD')).toBe('standard');
    expect(manufacturingComplexityDisplayKey('CUSTOM')).toBe('custom');
  });
});

describe('mapOrderPresentation', () => {
  it('maps RFQ draft / waiting / needs info', () => {
    expect(mapOrderPresentation({ requestStatus: 'DRAFT' })).toBe('draft');
    expect(mapOrderPresentation({ requestStatus: 'SUBMITTED' })).toBe('waitingForReview');
    expect(mapOrderPresentation({ requestStatus: 'UNDER_REVIEW' })).toBe('waitingForReview');
    expect(mapOrderPresentation({ requestStatus: 'NEEDS_INFORMATION' })).toBe(
      'needsInformation',
    );
  });

  it('maps SO draft to production setup', () => {
    expect(mapOrderPresentation({ salesOrderStatus: 'DRAFT' })).toBe('productionSetup');
    expect(
      mapOrderPresentation({ salesOrderStatus: 'DRAFT', productionSetupRequired: true }),
    ).toBe('productionSetup');
  });

  it('maps later SO and delivery states', () => {
    expect(mapOrderPresentation({ salesOrderStatus: 'IN_PRODUCTION' })).toBe('inProduction');
    expect(mapOrderPresentation({ salesOrderStatus: 'READY_FOR_PRODUCTION' })).toBe(
      'inProduction',
    );
    expect(mapOrderPresentation({ salesOrderStatus: 'WAITING_FOR_MATERIALS' })).toBe(
      'inProduction',
    );
    expect(mapOrderPresentation({ salesOrderStatus: 'READY_FOR_DELIVERY' })).toBe('readyToShip');
    expect(mapOrderPresentation({ deliveryStatus: 'OUT_FOR_DELIVERY' })).toBe('shipped');
    expect(mapOrderPresentation({ deliveryStatus: 'DELIVERED' })).toBe('delivered');
  });
});

describe('requestStatusesForGroup', () => {
  it('expands waiting_review to SUBMITTED and UNDER_REVIEW', () => {
    expect(requestStatusesForGroup('waiting_review')).toEqual([
      'SUBMITTED',
      'UNDER_REVIEW',
    ]);
    expect(requestStatusesForGroup('drafts')).toEqual(['DRAFT']);
    expect(requestStatusesForGroup('needs_information')).toEqual(['NEEDS_INFORMATION']);
  });

  it('expands open_inbox to active dealer request statuses', () => {
    expect(requestStatusesForGroup('open_inbox')).toEqual([
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'NEEDS_INFORMATION',
      'READY_FOR_QUOTATION',
      'QUOTED',
    ]);
  });
});

describe('appendReviewHistory', () => {
  it('appends without dropping prior entries', () => {
    const next = appendReviewHistory([{ at: 'a', action: 'SUBMITTED' }], {
      at: 'b',
      action: 'NEEDS_INFORMATION',
      message: 'dims unclear',
    });
    expect(next).toHaveLength(2);
    expect(next[1].message).toBe('dims unclear');
  });
});

describe('classifyDealerLifecycle intake chips', () => {
  it('classifies RFQ waiting and needs information', () => {
    expect(classifyDealerLifecycle({ requestStatus: 'SUBMITTED' })).toBe('waiting');
    expect(classifyDealerLifecycle({ requestStatus: 'NEEDS_INFORMATION' })).toBe(
      'needsInformation',
    );
    expect(classifyDealerLifecycle({ isDraft: true })).toBe('draft');
  });

  it('treats accepted SO draft as pending (production setup), not draft', () => {
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'DRAFT',
        productionSetupRequired: true,
      }),
    ).toBe('pending');
  });

  it('treats post-release factory statuses as inProduction', () => {
    expect(
      classifyDealerLifecycle({ salesOrderStatus: 'READY_FOR_PRODUCTION' }),
    ).toBe('inProduction');
    expect(
      classifyDealerLifecycle({ salesOrderStatus: 'WAITING_FOR_MATERIALS' }),
    ).toBe('inProduction');
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'CONFIRMED',
        productionStarted: true,
      }),
    ).toBe('inProduction');
  });
});
