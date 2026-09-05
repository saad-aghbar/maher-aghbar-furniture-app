import {
  assessFabricReadiness,
  buildFabricProcurementWhatsAppBody,
  fabricStageIsReady,
  isOrderAllocatedFabricLot,
  summarizeFabricReadiness,
} from './fabric-readiness';

const req = {
  id: 'req-1',
  salesOrderId: 'so-1',
  label: 'Velvet 302 · Beige',
  sku: 'FAB-VEL-302',
  inventoryItemId: 'inv-vel',
  expectedQty: 24,
  unit: 'm',
  fabricRole: 'Main body',
  stageCode: 'UPHOLSTERY',
};

function lot(partial: Partial<Parameters<typeof assessFabricReadiness>[0]['lots']>[number] & { id: string }) {
  return {
    quantity: 24,
    remainingQty: 24,
    status: 'AVAILABLE',
    allocationMode: 'ORDER_ALLOCATED',
    salesOrderId: 'so-1',
    locationId: 'loc-1',
    inventoryItemId: 'inv-vel',
    sku: 'FAB-VEL-302',
    ...partial,
  };
}

describe('assessFabricReadiness', () => {
  it('stays NEEDS_ORDERING when nothing has been ordered', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'NEEDS_ORDERING' },
    });
    expect(result.derivedStatus).toBe('NEEDS_ORDERING');
    expect(result.readyForProduction).toBe(false);
    expect(result.attentionCode).toBe('FABRIC_NOT_ORDERED');
  });

  it('derives READY_FOR_PRODUCTION when identity, allocation, qty, location and receipt all hold', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'READY_FOR_PICKUP' },
      lots: [lot({ id: 'lot-1' })],
    });
    expect(result.derivedStatus).toBe('READY_FOR_PRODUCTION');
    expect(result.readyForProduction).toBe(true);
    expect(result.attentionCode).toBe('FABRIC_READY_NOT_TAKEN');
  });

  it('derives PARTIAL when received qty is short and not explicitly approved', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'SUPPLIER_CONFIRMED' },
      lots: [lot({ id: 'lot-1', quantity: 10, remainingQty: 10 })],
    });
    expect(result.derivedStatus).toBe('PARTIAL');
    expect(result.readyForProduction).toBe(false);
    expect(result.attentionCode).toBe('FABRIC_PARTIAL');
  });

  it('allows partial when PARTIALLY_AVAILABLE is stored', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'PARTIALLY_AVAILABLE' },
      lots: [lot({ id: 'lot-1', quantity: 10, remainingQty: 10 })],
    });
    expect(result.readyForProduction).toBe(true);
    expect(result.derivedStatus).toBe('READY_FOR_PRODUCTION');
  });

  it('blocks when location is missing', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'READY_FOR_PICKUP' },
      lots: [lot({ id: 'lot-1', locationId: null })],
    });
    expect(result.derivedStatus).toBe('ARRIVED');
    expect(result.readyForProduction).toBe(false);
    expect(result.attentionCode).toBe('FABRIC_LOCATION_MISSING');
    expect(result.missing).toContain('location');
  });

  it('rejects quarantined / damaged lots', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'READY_FOR_PICKUP' },
      lots: [lot({ id: 'lot-1', status: 'QUARANTINED' })],
    });
    expect(result.readyForProduction).toBe(false);
    expect(result.derivedStatus).toBe('READY_FOR_PICKUP');
  });

  it('flags wrong fabric received', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'READY_FOR_PICKUP' },
      lots: [
        lot({
          id: 'lot-wrong',
          inventoryItemId: 'inv-other',
          sku: 'FAB-OTHER',
        }),
      ],
    });
    expect(result.attentionCode).toBe('FABRIC_WRONG_RECEIVED');
    expect(result.readyForProduction).toBe(false);
  });

  it('does not treat another order’s allocated lot as coverage', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'NEEDS_ORDERING' },
      lots: [lot({ id: 'lot-2', salesOrderId: 'so-other' })],
    });
    expect(result.readyForProduction).toBe(false);
    expect(result.arrivedQty).toBe(0);
  });

  it('derives ISSUED from usage / consumed lots', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: { state: 'READY_FOR_PICKUP' },
      lots: [lot({ id: 'lot-1', remainingQty: 0, status: 'CONSUMED' })],
      usages: [{ inventoryLotId: 'lot-1', actualQty: 24 }],
    });
    expect(result.derivedStatus).toBe('ISSUED');
    expect(result.readyForProduction).toBe(true);
    expect(result.attentionCode).toBeNull();
  });

  it('override does not mark fabric ready', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: {
        state: 'WAITING',
        fabricHoldOverriddenAt: new Date().toISOString(),
      },
    });
    expect(result.overridden).toBe(true);
    expect(result.readyForProduction).toBe(false);
    expect(result.attentionCode).toBe('FABRIC_HOLD_OVERRIDDEN');
  });

  it('marks FABRIC_LATE when ETA has passed and nothing arrived', () => {
    const result = assessFabricReadiness({
      requirement: req,
      procurement: {
        state: 'SUPPLIER_CONFIRMED',
        expectedAvailableAt: '2026-08-01T00:00:00.000Z',
      },
      now: new Date('2026-09-03T00:00:00.000Z'),
    });
    expect(result.attentionCode).toBe('FABRIC_LATE');
  });
});

describe('summarizeFabricReadiness / fabricStageIsReady', () => {
  it('reports missing count and per-stage gate', () => {
    const items = [
      assessFabricReadiness({
        requirement: { ...req, id: 'a', stageCode: 'CARPENTRY' },
        procurement: { state: 'NEEDS_ORDERING' },
      }),
      assessFabricReadiness({
        requirement: { ...req, id: 'b', stageCode: 'UPHOLSTERY' },
        procurement: { state: 'READY_FOR_PICKUP' },
        lots: [lot({ id: 'lot-1' })],
      }),
    ];
    const summary = summarizeFabricReadiness(items);
    expect(summary.required).toBe(2);
    expect(summary.ready).toBe(1);
    expect(summary.missing).toHaveLength(1);

    expect(fabricStageIsReady(items, 'CARPENTRY').ready).toBe(false);
    expect(fabricStageIsReady(items, 'UPHOLSTERY').ready).toBe(true);
  });

  it('lets a stage with no fabric requirements start', () => {
    expect(fabricStageIsReady([], 'CARPENTRY').ready).toBe(true);
  });
});

describe('isOrderAllocatedFabricLot', () => {
  it('treats ORDER_ALLOCATED and procurement-linked lots as exclusive', () => {
    expect(isOrderAllocatedFabricLot({ allocationMode: 'ORDER_ALLOCATED' })).toBe(true);
    expect(isOrderAllocatedFabricLot({ fabricProcurementId: 'fp-1' })).toBe(true);
    expect(isOrderAllocatedFabricLot({ allocationMode: 'GENERAL_STOCK' })).toBe(false);
  });
});

describe('buildFabricProcurementWhatsAppBody', () => {
  it('keeps per-requirement traceability in a batched message', () => {
    const body = buildFabricProcurementWhatsAppBody({
      orderNumber: 'SO-1042',
      productName: 'Milano Sofa',
      dealerName: 'Nablus Showroom',
      lines: [
        {
          procurementId: 'aaaaaaaa-1111-2222-3333-444444444444',
          label: 'Velvet 302',
          role: 'Main body',
          qty: 24,
          unit: 'm',
        },
        {
          procurementId: 'bbbbbbbb-1111-2222-3333-444444444444',
          label: 'Bouclé 611',
          role: 'Cushions',
          qty: 8,
          unit: 'm',
        },
      ],
    });
    expect(body).toContain('SO-1042');
    expect(body).toContain('Velvet 302 (Main body): 24 m [aaaaaaaa]');
    expect(body).toContain('Bouclé 611 (Cushions): 8 m [bbbbbbbb]');
  });
});
