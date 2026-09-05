import {
  classifyManufacturingComplexity,
  buildOrderLineSpecSnapshot,
  manufacturingComplexityDisplayKey,
} from '../manufacturing-complexity';
import {
  mapOrderPresentation,
  requestStatusesForGroup,
  classifyRequestInboxChip,
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

  it('returns STANDARD when fabric, colour, notes, or description are set', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        fabricType: 'Velvet',
        fabricColor: 'Navy',
        notes: 'Gate code 12',
        description: 'Customer fabric from stock',
        catalog: { width: 220 },
      }),
    ).toBe('STANDARD');
  });

  it('returns MODIFIED when wood, foam, finish, or accessories are set', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        woodType: 'Walnut',
        catalog: { width: 220 },
      }),
    ).toBe('MODIFIED');
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        foamDensity: '35',
        catalog: { width: 220 },
      }),
    ).toBe('MODIFIED');
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        finish: 'Matte lacquer',
        catalog: { width: 220 },
      }),
    ).toBe('MODIFIED');
  });

  it('returns STANDARD when custom measurements match the catalog seed', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        width: 220,
        height: 85,
        depth: 95,
        customMeasurements: [
          { label: 'Seat height (cm)', value: '45' },
          { label: 'Arm', value: '60' },
        ],
        catalog: {
          width: 220,
          height: 85,
          depth: 95,
          seatHeight: 45,
          customMeasurements: [{ nameEn: 'Arm', nameAr: 'ذراع', value: 60 }],
        },
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

  it('returns MODIFIED when a dimension is set and catalog has no baseline', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        width: 220,
        catalog: {},
      }),
    ).toBe('MODIFIED');
  });

  it('returns MODIFIED when a custom measurement is added or changed', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        customMeasurements: [{ label: 'Arm', value: '70' }],
        catalog: {
          customMeasurements: [{ nameEn: 'Arm', value: 60 }],
        },
      }),
    ).toBe('MODIFIED');
    expect(
      classifyManufacturingComplexity({
        productId: 'p1',
        customMeasurements: [{ label: 'Chaise', value: '160' }],
        catalog: { width: 220, height: 85, depth: 95 },
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
    expect(snap.fabrics).toEqual([
      expect.objectContaining({ type: 'Linen', color: 'Sand' }),
    ]);
  });

  it('keeps a multi-fabric list without changing manufacturing complexity', () => {
    const snap = buildOrderLineSpecSnapshot({
      productId: 'p1',
      productName: 'Sofa',
      quantity: 1,
      catalog: { width: 180 },
      width: 180,
      fabrics: [
        { key: 'a', type: 'Velvet 302', color: 'Beige', role: 'Main body' },
        { key: 'b', type: 'Bouclé', color: 'Cream', role: 'Cushions' },
      ],
    });
    expect(snap.manufacturingComplexity).toBe('STANDARD');
    expect(snap.fabrics).toHaveLength(2);
    expect(snap.fabric?.type).toBe('Velvet 302');
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

describe('classifyRequestInboxChip', () => {
  it('maps factory-review statuses and ignores closed', () => {
    expect(classifyRequestInboxChip('SUBMITTED')).toBe('waiting');
    expect(classifyRequestInboxChip('UNDER_REVIEW')).toBe('waiting');
    expect(classifyRequestInboxChip('NEEDS_INFORMATION')).toBe('needs_info');
    expect(classifyRequestInboxChip('QUOTED')).toBe('quoted');
    expect(classifyRequestInboxChip('DRAFT')).toBe('drafts');
    expect(classifyRequestInboxChip('CLOSED')).toBeNull();
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
