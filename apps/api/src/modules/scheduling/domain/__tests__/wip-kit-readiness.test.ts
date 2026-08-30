import {
  assessWipKitsReady,
  assessWipLotsReady,
} from '../wip-readiness';

describe('assessWipKitsReady', () => {
  const nodes = [
    {
      id: 'n-carp',
      stageCode: 'CARPENTRY',
      isSkipped: false,
      consumesSemiFinished: false,
      inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      stageInstanceId: 'si-carp',
    },
    {
      id: 'n-assy',
      stageCode: 'ASSEMBLY',
      isSkipped: false,
      consumesSemiFinished: true,
      inventoryTracking: 'NONE',
      stageInstanceId: 'si-assy',
    },
  ];

  it('passes when producer kit is READY', () => {
    expect(
      assessWipKitsReady(nodes, [
        { stageInstanceId: 'si-carp', status: 'READY' },
      ]),
    ).toBe(true);
  });

  it('fails when producer kit is still OPEN', () => {
    expect(
      assessWipKitsReady(nodes, [
        { stageInstanceId: 'si-carp', status: 'OPEN' },
      ]),
    ).toBe(false);
  });

  it('ignores missing kits (lot path may apply)', () => {
    expect(assessWipKitsReady(nodes, [])).toBe(true);
  });
});

describe('assessWipKitsReady scheduling regression', () => {
  it('unlocks schedule on READY without physical receive (CLAIMED)', () => {
    const nodes = [
      {
        id: 'n-carp',
        stageCode: 'CARPENTRY',
        isSkipped: false,
        consumesSemiFinished: false,
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
        stageInstanceId: 'si-carp',
      },
      {
        id: 'n-assy',
        stageCode: 'ASSEMBLY',
        isSkipped: false,
        consumesSemiFinished: true,
        inventoryTracking: 'NONE',
        stageInstanceId: 'si-assy',
      },
    ];
    expect(
      assessWipKitsReady(nodes, [
        { stageInstanceId: 'si-carp', status: 'READY', nextSnapshotNodeIds: ['n-assy'] },
      ]),
    ).toBe(true);
  });
});

describe('assessWipLotsReady still works', () => {
  it('requires lots for consumers', () => {
    const nodes = [
      {
        stageCode: 'CARPENTRY',
        isSkipped: false,
        consumesSemiFinished: false,
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
        outputInventoryItemId: 'item-1',
        outputQtyPerUnit: 1,
      },
      {
        stageCode: 'ASSEMBLY',
        isSkipped: false,
        consumesSemiFinished: true,
        inventoryTracking: 'NONE',
        consumeInventoryItemIds: ['item-1'],
      },
    ];
    expect(assessWipLotsReady(nodes, [], 1)).toBe(false);
    expect(
      assessWipLotsReady(nodes, [{ inventoryItemId: 'item-1', quantity: 1 }], 1),
    ).toBe(true);
  });
});
