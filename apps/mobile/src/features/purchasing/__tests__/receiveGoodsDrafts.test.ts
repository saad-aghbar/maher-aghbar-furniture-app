import type { PurchaseOrder } from '@/api/modules/purchasing';
import {
  acceptedReceiveQty,
  allReceiveLinesChecked,
  applyReceiveDestinationNames,
  applyReceiveScanVerify,
  buildReceivableDrafts,
  buildReceivePayload,
  groupReceiveDraftsByWarehouse,
  isOverReceipt,
  receiveCheckedCount,
  receiveDestinationLabel,
  receiveDraftsForNames,
  receiveLineReadyIssue,
  tryMarkReceiveLineDone,
  validateReceiveDrafts,
} from '../receiveLineDrafts';

function order(lines: PurchaseOrder['lines']): PurchaseOrder {
  return {
    id: 'po-1',
    number: 'PO-1',
    status: 'SENT',
    supplierId: 's1',
    warehouseId: 'w1',
    lines,
  };
}

describe('buildReceivableDrafts', () => {
  it('excludes fabric lines and keeps remaining non-fabric lines', () => {
    const drafts = buildReceivableDrafts(
      order([
        {
          id: 'ln-fabric',
          description: 'Velvet navy',
          quantity: 12,
          unit: 'm',
          unitPrice: 18,
          inventoryItemId: 'inv-vel',
          receivedQty: 0,
          remainingQty: 12,
          fabricProcurementId: 'fp-1',
        },
        {
          id: 'ln-foam',
          description: 'Foam 28',
          quantity: 4,
          unit: 'pcs',
          unitPrice: 22,
          inventoryItemId: 'inv-foam',
          receivedQty: 1,
          remainingQty: 3,
        },
        {
          id: 'ln-done',
          description: 'Staples',
          quantity: 10,
          unit: 'pcs',
          unitPrice: 1,
          inventoryItemId: 'inv-staples',
          receivedQty: 10,
          remainingQty: 0,
        },
      ]),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      lineId: 'ln-foam',
      inventoryItemId: 'inv-foam',
      remaining: 3,
      receiveNow: '3',
      warehouseId: 'w1',
    });
  });
});

describe('receiveLineDrafts', () => {
  it('defaults per-line warehouse and requires a fabric location', () => {
    const drafts = buildReceivableDrafts(
      order([
        {
          id: 'ln-vel',
          description: 'Velvet',
          quantity: 5,
          unitPrice: 10,
          inventoryItemId: 'inv-vel',
          remainingQty: 5,
          warehouseId: 'w-hold',
          isFabric: true,
        },
      ]),
      { includeManualFabric: true },
    );
    expect(drafts[0].warehouseId).toBe('w-hold');
    expect(validateReceiveDrafts(drafts)).toBe('holding');
  });

  it('blocks over-receipt and reduces accepted qty by reject', () => {
    const draft = {
      lineId: '1',
      inventoryItemId: 'i1',
      description: 'Oak',
      unit: 'pcs',
      orderedQty: 4,
      alreadyReceived: 1,
      remaining: 3,
      receiveNow: '5',
      rejectedQty: '1',
      unitCost: '2',
      warehouseId: 'w1',
      locationId: '',
      isFabric: false,
    };
    expect(acceptedReceiveQty('4', '1')).toBe(3);
    expect(isOverReceipt(draft)).toBe(true);
    expect(validateReceiveDrafts([{ ...draft, receiveNow: '3' }])).toBe('holding');
    expect(validateReceiveDrafts([{ ...draft, receiveNow: '3', locationId: 'loc-1' }])).toBeNull();
  });

  it('stamps verified only when the scanned item matches the line', () => {
    const drafts = [
      {
        lineId: '1',
        inventoryItemId: 'i1',
        description: 'Oak',
        unit: 'pcs',
        orderedQty: 4,
        alreadyReceived: 0,
        remaining: 4,
        receiveNow: '4',
        rejectedQty: '0',
        unitCost: '2',
        warehouseId: 'w1',
        locationId: '',
        isFabric: false,
        verified: false,
      },
    ];
    expect(applyReceiveScanVerify(drafts, '1', 'i1')[0]?.verified).toBe(true);
    expect(applyReceiveScanVerify(drafts, '1', 'other')[0]?.verified).toBe(false);
    expect(groupReceiveDraftsByWarehouse(drafts)[0]?.warehouseId).toBe('w1');
  });

  it('shows the holding place name once it is resolved', () => {
    const [named] = applyReceiveDestinationNames(
      [
        {
          lineId: '1',
          inventoryItemId: 'i1',
          description: 'Velvet',
          unit: 'm',
          orderedQty: 5,
          alreadyReceived: 0,
          remaining: 5,
          receiveNow: '5',
          rejectedQty: '0',
          unitCost: '10',
          warehouseId: 'w-hold',
          locationId: 'loc-1',
          isFabric: true,
        },
      ],
      [
        {
          id: 'w-hold',
          nameEn: 'Raw holds',
          locations: [{ id: 'loc-1', name: 'Front bay' }],
        },
      ],
      'en',
    );
    expect(receiveDestinationLabel(named!)).toBe('Raw holds · \u2066Front bay\u2069');
    expect(named?.warehouseName).toBe('Raw holds');
  });

  it('fills the warehouse default bin when the line has no location', () => {
    const [named] = applyReceiveDestinationNames(
      [
        {
          lineId: '1',
          inventoryItemId: 'i1',
          description: 'Beech',
          unit: 'm',
          orderedQty: 5,
          alreadyReceived: 0,
          remaining: 5,
          receiveNow: '5',
          rejectedQty: '0',
          unitCost: '10',
          warehouseId: 'w-raw',
          locationId: '',
          isFabric: false,
        },
      ],
      [
        {
          id: 'w-raw',
          nameEn: 'Raw Materials',
          locations: [
            { id: 'overflow', code: 'RAW-B', name: 'Overflow' },
            { id: 'main', code: 'RAW-MAIN', name: 'Main floor', isDefault: true },
          ],
        },
      ],
      'en',
    );
    expect(named?.locationId).toBe('main');
    expect(receiveDestinationLabel(named!)).toBe('Raw Materials · \u2066RAW-MAIN — Main floor\u2069');
  });

  it('marks a line done only when qty, dest, and remaining are ready', () => {
    const ready = {
      lineId: '1',
      inventoryItemId: 'i1',
      description: 'Oak',
      unit: 'pcs',
      orderedQty: 4,
      alreadyReceived: 0,
      remaining: 4,
      receiveNow: '4',
      rejectedQty: '0',
      unitCost: '2',
      warehouseId: 'w1',
      locationId: 'loc-1',
      isFabric: false,
      checked: false,
    };
    expect(receiveLineReadyIssue({ ...ready, receiveNow: '0' })).toBe('qty');
    expect(receiveLineReadyIssue({ ...ready, warehouseId: '' })).toBe('warehouse');
    expect(receiveLineReadyIssue({ ...ready, locationId: '' })).toBe('holding');
    expect(receiveLineReadyIssue({ ...ready, isFabric: true, locationId: '' })).toBe('holding');
    expect(tryMarkReceiveLineDone([ready], '1').issue).toBeNull();
    expect(tryMarkReceiveLineDone([ready], '1').drafts[0]?.checked).toBe(true);
    expect(tryMarkReceiveLineDone([{ ...ready, warehouseId: '' }], '1').issue).toBe('warehouse');
    expect(allReceiveLinesChecked([ready])).toBe(false);
    expect(allReceiveLinesChecked([{ ...ready, checked: true }])).toBe(true);
    expect(allReceiveLinesChecked([])).toBe(false);
    expect(receiveCheckedCount([{ ...ready, checked: true }, ready])).toEqual({ done: 1, total: 2 });
  });
});

describe('buildReceivePayload', () => {
  it('omits a typed unit cost so the catalog price is used', () => {
    const body = buildReceivePayload([
      {
        lineId: '1',
        inventoryItemId: 'i1',
        description: 'Oak',
        unit: 'pcs',
        orderedQty: 4,
        alreadyReceived: 0,
        remaining: 4,
        receiveNow: '4',
        rejectedQty: '0',
        unitCost: '99',
        warehouseId: 'w1',
        locationId: '',
        isFabric: false,
      },
    ]);
    expect(body.lines[0]).not.toHaveProperty('unitCost');
    expect(body.lines[0]?.receivedQty).toBe(4);
  });

  it('does not keep an empty draft list after the order lines arrive', () => {
    const seeded = [
      {
        lineId: '1',
        inventoryItemId: 'i1',
        description: 'Oak',
        unit: 'pcs',
        orderedQty: 4,
        alreadyReceived: 0,
        remaining: 4,
        receiveNow: '4',
        rejectedQty: '0',
        unitCost: '2',
        warehouseId: 'w1',
        locationId: 'loc-1',
        isFabric: false,
      },
    ];
    expect(receiveDraftsForNames(null, seeded)).toEqual(seeded);
    expect(receiveDraftsForNames([], seeded)).toEqual(seeded);
    expect(receiveDraftsForNames(seeded, seeded)).toEqual(seeded);
  });
});
