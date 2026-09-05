import { fabricStageIsReady, assessFabricReadiness } from './fabric-readiness';

const so = 'so-1';
const req = {
  id: 'req-uph',
  salesOrderId: so,
  label: 'Velvet 302',
  sku: 'FAB-VEL',
  inventoryItemId: 'inv-vel',
  expectedQty: 24,
  unit: 'm',
  fabricRole: 'Main body',
  stageCode: 'UPHOLSTERY',
};

const readyLot = {
  id: 'lot-1',
  quantity: 24,
  remainingQty: 24,
  status: 'AVAILABLE',
  allocationMode: 'ORDER_ALLOCATED',
  salesOrderId: so,
  locationId: 'loc-1',
  inventoryItemId: 'inv-vel',
};

describe('fabric per-stage gate', () => {
  it('lets carpentry start while upholstery fabric is still in transit', () => {
    const items = [
      assessFabricReadiness({
        requirement: req,
        procurement: { state: 'AWAITING_SUPPLIER' },
      }),
    ];
    expect(fabricStageIsReady(items, 'CARPENTRY').ready).toBe(true);
    expect(fabricStageIsReady(items, 'UPHOLSTERY').ready).toBe(false);
  });

  it('blocks upholstery until fabric is ready', () => {
    const items = [
      assessFabricReadiness({
        requirement: req,
        procurement: { state: 'READY_FOR_PICKUP' },
        lots: [readyLot],
      }),
    ];
    expect(fabricStageIsReady(items, 'UPHOLSTERY').ready).toBe(true);
  });

  it('override lets the stage start without marking fabric ready', () => {
    const items = [
      assessFabricReadiness({
        requirement: req,
        procurement: {
          state: 'WAITING',
          fabricHoldOverriddenAt: new Date().toISOString(),
        },
      }),
    ];
    expect(items[0]!.readyForProduction).toBe(false);
    expect(items[0]!.overridden).toBe(true);
    expect(fabricStageIsReady(items, 'UPHOLSTERY').ready).toBe(true);
    expect(fabricStageIsReady(items, 'UPHOLSTERY').missing).toHaveLength(0);
  });
});
