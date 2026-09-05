import { verdictFabricTakeInScan, fabricTakeInErrorKey } from '../fabricTakeInScan';
import type { FabricTaskBoard } from '@/api/modules/purchasing';

const items: FabricTaskBoard['items'] = [
  {
    id: 'fp-1',
    label: 'Velvet 302 · Sand',
    role: 'Main body',
    stageCode: 'UPHOLSTERY',
    derivedStatus: 'READY_FOR_PRODUCTION',
    readyForProduction: true,
    expectedQty: 24,
    arrivedQty: 24,
    issuedQty: 0,
    unit: 'm',
    lots: [
      {
        id: 'lot-1',
        qrCode: 'FB-SOFB1042-001',
        remainingQty: 24,
        status: 'AVAILABLE',
        locationLabel: 'Holding A-3',
      },
    ],
  },
];

describe('verdictFabricTakeInScan', () => {
  it('matches the required bundle', () => {
    const verdict = verdictFabricTakeInScan({
      code: 'FB-SOFB1042-001',
      items,
      taskSalesOrderId: 'so-fb1042',
      scannedLot: { salesOrderId: 'so-fb1042', salesOrderNumber: 'SO-FB1042', scanKind: 'ORDER_FABRIC' },
    });
    expect(verdict.kind).toBe('match');
    if (verdict.kind === 'match') expect(verdict.item.label).toContain('Velvet');
  });

  it('rejects a bundle from another order', () => {
    const verdict = verdictFabricTakeInScan({
      code: 'FB-OTHER-001',
      items,
      taskSalesOrderId: 'so-fb1042',
      scannedLot: { salesOrderId: 'so-other', scanKind: 'ORDER_FABRIC', fabricProcurementId: 'fp-x' },
    });
    expect(verdict.kind).toBe('wrong_order');
    expect(fabricTakeInErrorKey(verdict.kind)).toBe('mobile.tasks.fabricWrongOrder');
  });

  it('rejects the wrong fabric on the same order', () => {
    const verdict = verdictFabricTakeInScan({
      code: 'FB-SOFB1042-099',
      items,
      taskSalesOrderId: 'so-fb1042',
      scannedLot: { salesOrderId: 'so-fb1042', scanKind: 'ORDER_FABRIC', fabricProcurementId: 'fp-x' },
    });
    expect(verdict.kind).toBe('wrong_fabric');
    expect(fabricTakeInErrorKey(verdict.kind)).toBe('mobile.tasks.fabricWrongFabric');
  });

  it('says the fabric has not arrived when no bundle exists yet', () => {
    const waiting: FabricTaskBoard['items'] = [
      {
        ...items[0]!,
        derivedStatus: 'WAITING',
        readyForProduction: false,
        arrivedQty: 0,
        lots: [],
      },
    ];
    const verdict = verdictFabricTakeInScan({
      code: 'FB-WHATEVER',
      items: waiting,
      taskSalesOrderId: 'so-fb1042',
    });
    expect(verdict.kind).toBe('not_arrived');
    expect(fabricTakeInErrorKey('FABRIC_NOT_READY')).toBe('mobile.tasks.fabricNotArrived');
  });
});
