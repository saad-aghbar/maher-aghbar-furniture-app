import {
  selectFabricTrackerRow,
  fabricTakeInProgress,
  fabricLaneOf,
  fabricLaneCounts,
  fabricToneOf,
  fabricRowFromHolding,
  fabricStatusKind,
  fabricDeskBucketOf,
  fabricDeskBucketCounts,
  filterRowsByDeskBucket,
  filterFabricRowsByPurchasingStatus,
  groupFabricRowsBySalesOrder,
  fabricGroupReadiness,
  mergeFabricDeskRows,
  fabricRowHref,
  pickFabricBlockingRow,
  FABRIC_DESK_LANES,
  type FabricTrackerRow,
} from '../selectFabricTracker';
import type { FabricTrackerItem } from '@/api/modules/purchasing';
import type { FabricHoldingRow } from '@/api/modules/inventory';

function item(partial: Partial<FabricTrackerItem> & { id: string; derived?: string }): FabricTrackerItem {
  return {
    id: partial.id,
    salesOrderId: 'so-1',
    salesOrderNumber: 'SO-1042',
    dealerName: 'Oasis',
    productName: 'Sofa',
    supplier:
      'supplier' in partial ? (partial.supplier ?? null) : { id: 'sup-1', name: 'Fabric House' },
    lots: partial.lots ?? [],
    readiness: {
      requirementId: partial.id,
      label: 'Velvet 302',
      sku: 'FAB-VEL',
      role: 'Main body',
      stageCode: 'UPHOLSTERY',
      unit: 'm',
      expectedQty: 24,
      arrivedQty: 24,
      issuedQty: 0,
      storedState: 'READY_FOR_PICKUP',
      derivedStatus: partial.derived ?? 'READY_FOR_PRODUCTION',
      readyForProduction: (partial.derived ?? 'READY_FOR_PRODUCTION') === 'READY_FOR_PRODUCTION',
      overridden: false,
      missing: [],
      attentionCode: 'FABRIC_READY_NOT_TAKEN',
      expectedAvailableAt: null,
    },
  };
}

describe('selectFabricTracker', () => {
  it('maps the same payload identically for every surface', () => {
    const row = selectFabricTrackerRow(
      item({
        id: 'fp-1',
        lots: [
          {
            id: 'lot-1',
            qrCode: 'FB-SO1042-001',
            quantity: 24,
            remainingQty: 24,
            locationLabel: 'Fabric Holding A-3',
            status: 'AVAILABLE',
          },
        ],
      }),
    );
    expect(row.orderNumber).toBe('SO-1042');
    expect(row.locationLabel).toBe('Fabric Holding A-3');
    expect(row.qrCodes).toEqual(['FB-SO1042-001']);
    expect(row.derivedStatus).toBe('READY_FOR_PRODUCTION');
    expect(row.supplierName).toBe('Fabric House');
  });

  it('strips supplier when the payload already omitted it', () => {
    const row = selectFabricTrackerRow(item({ id: 'fp-2', supplier: null }));
    expect(row.supplierName).toBeNull();
  });

  it('shows 2 of 3 take-in progress', () => {
    const progress = fabricTakeInProgress([
      { derivedStatus: 'ISSUED' },
      { derivedStatus: 'ISSUED' },
      { derivedStatus: 'READY_FOR_PRODUCTION' },
    ]);
    expect(progress).toEqual({ taken: 2, total: 3 });
  });

  it('lanes from derived status', () => {
    expect(fabricLaneOf(item({ id: 'a', derived: 'ARRIVED' }))).toBe('ARRIVED');
  });
});

describe('fabric desk lanes', () => {
  it('counts lanes in floor reading order and drops empty ones', () => {
    const counts = fabricLaneCounts([
      { derivedStatus: 'READY_FOR_PRODUCTION' },
      { derivedStatus: 'NEEDS_ORDERING' },
      { derivedStatus: 'WAITING' },
      { derivedStatus: 'READY_FOR_PRODUCTION' },
    ]);
    expect(counts.map((c) => c.lane)).toEqual([
      'NEEDS_ORDERING',
      'WAITING',
      'READY_FOR_PRODUCTION',
    ]);
    expect(counts.find((c) => c.lane === 'READY_FOR_PRODUCTION')?.count).toBe(2);
    expect(counts.some((c) => c.lane === 'ARRIVED')).toBe(false);
  });

  it('keeps an unknown backend lane visible instead of dropping it', () => {
    const counts = fabricLaneCounts([{ derivedStatus: 'SOME_NEW_STATE' }]);
    expect(counts).toEqual([{ lane: 'SOME_NEW_STATE', count: 1, tone: 'waiting' }]);
  });

  it('maps every declared lane to a tone', () => {
    for (const lane of FABRIC_DESK_LANES) {
      expect(['ready', 'waiting', 'blocked', 'neutral']).toContain(fabricToneOf(lane));
    }
  });

  it('tones settled, waiting, and blocked states apart', () => {
    expect(fabricToneOf('ISSUED')).toBe('ready');
    expect(fabricToneOf('READY_FOR_PRODUCTION')).toBe('ready');
    expect(fabricToneOf('WAITING')).toBe('waiting');
    expect(fabricToneOf('AWAITING_SUPPLIER')).toBe('waiting');
    expect(fabricToneOf('UNAVAILABLE')).toBe('blocked');
    expect(fabricToneOf('DELAYED')).toBe('blocked');
    expect(fabricToneOf('NEEDS_ORDERING')).toBe('neutral');
  });
});

describe('fabricRowFromHolding', () => {
  const holding: FabricHoldingRow = {
    id: 'fp-9',
    label: 'Velvet 302 · Sand',
    role: 'Main body',
    sku: 'FAB-VEL',
    imageUrl: null,
    orderNumber: 'SO-FB1042',
    dealerName: 'Oasis Living',
    derivedStatus: 'READY_FOR_PRODUCTION',
    expectedQty: 24,
    arrivedQty: 24,
    unit: 'm',
    lots: [
      {
        id: 'lot-1',
        qrCode: 'FB-SOFB1042-001',
        remainingQty: 24,
        status: 'AVAILABLE',
        locationLabel: 'Fabric Holding A-3',
      },
    ],
  };

  it('reads identically to a tracker row', () => {
    const row = fabricRowFromHolding(holding);
    expect(row.label).toBe('Velvet 302 · Sand');
    expect(row.orderNumber).toBe('SO-FB1042');
    expect(row.locationLabel).toBe('Fabric Holding A-3');
    expect(row.qrCodes).toEqual(['FB-SOFB1042-001']);
    expect(row.readyForProduction).toBe(true);
  });

  it('survives a bundle with no QR yet', () => {
    const row = fabricRowFromHolding({
      ...holding,
      lots: [{ id: 'lot-2', remainingQty: 4, status: 'AVAILABLE' }],
    });
    expect(row.qrCodes).toEqual([]);
    expect(row.locationLabel).toBeNull();
  });
});

function asRow(partial: Partial<FabricTrackerRow> & { id: string }): FabricTrackerRow {
  return {
    id: partial.id,
    salesOrderId: partial.salesOrderId ?? 'so-fb1042',
    label: partial.label ?? 'Velvet 302 · Sand',
    role: partial.role ?? 'Main body',
    stageCode: 'UPHOLSTERY',
    derivedStatus: partial.derivedStatus ?? 'READY_FOR_PRODUCTION',
    storedState: 'READY_FOR_PICKUP',
    expectedQty: partial.expectedQty ?? 24,
    arrivedQty: partial.arrivedQty ?? 24,
    issuedQty: 0,
    unit: 'm',
    readyForProduction: partial.readyForProduction ?? true,
    overridden: partial.overridden ?? false,
    attentionCode: partial.attentionCode ?? null,
    orderNumber: partial.orderNumber ?? 'SO-FB1042',
    dealerName: 'Oasis Living',
    productName: '3-Seater Sofa',
    productImageUrl: null,
    supplierName: null,
    imageUrl: null,
    locationLabel: 'locationLabel' in partial ? partial.locationLabel ?? null : 'Fabric Holding A-3',
    qrCodes: partial.qrCodes ?? ['FB-SOFB1042-001'],
    lots: [],
  };
}

describe('groupFabricRowsBySalesOrder', () => {
  it('groups three fabrics under one sales order and keeps a second order separate', () => {
    const groups = groupFabricRowsBySalesOrder([
      asRow({ id: 'a', label: 'Velvet 302 · Sand' }),
      asRow({ id: 'b', label: 'Linen 180 · Natural', arrivedQty: 12, expectedQty: 12, qrCodes: ['FB-SOFB1042-002'] }),
      asRow({
        id: 'c',
        label: 'Bouclé 611 · Cream',
        derivedStatus: 'WAITING',
        readyForProduction: false,
        arrivedQty: 0,
        expectedQty: 18,
        locationLabel: null,
        qrCodes: [],
      }),
      asRow({
        id: 'd',
        salesOrderId: 'so-1048',
        orderNumber: 'SO-1048',
        label: 'Velvet 520',
        derivedStatus: 'WAITING',
        readyForProduction: false,
        arrivedQty: 0,
        qrCodes: [],
      }),
    ]);
    expect(groups).toHaveLength(2);
    const primary = groups.find((g) => g.orderNumber === 'SO-FB1042');
    const other = groups.find((g) => g.orderNumber === 'SO-1048');
    expect(primary?.rows.map((r) => r.label)).toEqual([
      'Velvet 302 · Sand',
      'Linen 180 · Natural',
      'Bouclé 611 · Cream',
    ]);
    expect(other?.rows).toHaveLength(1);
    expect(fabricGroupReadiness(primary!.rows)).toEqual({ ready: 2, required: 3 });
  });

  it('keeps order grouping when filtering by waiting supplier', () => {
    const rows = [
      asRow({ id: 'a' }),
      asRow({
        id: 'c',
        label: 'Bouclé 611 · Cream',
        derivedStatus: 'WAITING',
        readyForProduction: false,
        arrivedQty: 0,
        qrCodes: [],
      }),
      asRow({
        id: 'd',
        salesOrderId: 'so-1048',
        orderNumber: 'SO-1048',
        label: 'Velvet 520',
        derivedStatus: 'AWAITING_SUPPLIER',
        readyForProduction: false,
        arrivedQty: 0,
        qrCodes: [],
      }),
    ];
    const waiting = filterRowsByDeskBucket(rows, 'waiting_supplier');
    const groups = groupFabricRowsBySalesOrder(waiting);
    expect(groups.map((g) => g.orderNumber).sort()).toEqual(['SO-1048', 'SO-FB1042']);
    expect(groups.find((g) => g.orderNumber === 'SO-FB1042')?.rows).toHaveLength(1);
  });
});

describe('canonical fabric status', () => {
  it('never treats a short quantity as ready, even if the API marked it ready', () => {
    const kind = fabricStatusKind({
      derivedStatus: 'READY_FOR_PRODUCTION',
      overridden: false,
      readyForProduction: true,
      expectedQty: 12,
      arrivedQty: 4,
      attentionCode: null,
    });
    expect(kind).toBe('PARTIAL');
    expect(fabricDeskBucketOf({
      derivedStatus: 'PARTIAL',
      overridden: false,
      readyForProduction: false,
      expectedQty: 24,
      arrivedQty: 14,
      attentionCode: 'FABRIC_PARTIAL',
    })).toBe('attention');
  });

  it('keeps zero arrived as waiting, not partial', () => {
    expect(
      fabricStatusKind({
        derivedStatus: 'WAITING',
        overridden: false,
        readyForProduction: false,
        expectedQty: 18,
        arrivedQty: 0,
        attentionCode: null,
      }),
    ).toBe('WAITING');
  });

  it('keeps override visually distinct from ready', () => {
    expect(
      fabricStatusKind({
        derivedStatus: 'WAITING',
        overridden: true,
        readyForProduction: false,
        expectedQty: 18,
        arrivedQty: 0,
        attentionCode: 'FABRIC_HOLD_OVERRIDDEN',
      }),
    ).toBe('OVERRIDDEN');
  });

  it('maps desk buckets for the five operational cells', () => {
    const counts = fabricDeskBucketCounts([
      asRow({ id: '1' }),
      asRow({ id: '2', derivedStatus: 'NEEDS_ORDERING', readyForProduction: false, arrivedQty: 0 }),
      asRow({ id: '3', derivedStatus: 'WAITING', readyForProduction: false, arrivedQty: 0 }),
    ]);
    expect(counts.find((c) => c.bucket === 'in_holding')?.count).toBe(1);
    expect(counts.find((c) => c.bucket === 'needs_ordering')?.count).toBe(1);
    expect(counts.find((c) => c.bucket === 'waiting_supplier')?.count).toBe(1);
  });
});

describe('mergeFabricDeskRows', () => {
  it('copies holding location onto the procurement row with the same id', () => {
    const queue = [asRow({ id: 'fp-1', locationLabel: null, qrCodes: [] })];
    const holding = [asRow({ id: 'fp-1', locationLabel: 'Holding A-3', qrCodes: ['FB-1'] })];
    const merged = mergeFabricDeskRows(queue, holding);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.locationLabel).toBe('Holding A-3');
    expect(merged[0]?.qrCodes).toEqual(['FB-1']);
  });
});

describe('fabric tap destination', () => {
  it('opens the bundle when a QR exists, otherwise procurement', () => {
    expect(fabricRowHref(asRow({ id: 'fp-1', qrCodes: ['FB-SOFB1042-001'] }))).toContain(
      'fabric-bundle/FB-SOFB1042-001',
    );
    expect(fabricRowHref(asRow({ id: 'fp-wait', qrCodes: [] }))).toBe(
      '/(app)/(admin)/purchasing/fabric/fp-wait',
    );
  });
});

describe('blocking row + purchasing status filter', () => {
  it('prefers a waiting fabric over a partial one for the production note', () => {
    const waiting = asRow({
      id: 'c',
      label: 'Bouclé 611 · Cream',
      derivedStatus: 'WAITING',
      readyForProduction: false,
      arrivedQty: 0,
      expectedQty: 18,
      qrCodes: [],
    });
    const partial = asRow({
      id: 'b',
      label: 'Linen 180 · Natural',
      derivedStatus: 'READY_FOR_PRODUCTION',
      readyForProduction: true,
      arrivedQty: 4,
      expectedQty: 12,
    });
    expect(pickFabricBlockingRow([partial, waiting])?.label).toBe('Bouclé 611 · Cream');
  });

  it('keeps order grouping when filtering Partial, including short qty marked ready', () => {
    const rows = [
      asRow({ id: 'a' }),
      asRow({
        id: 'b',
        label: 'Linen 180 · Natural',
        derivedStatus: 'READY_FOR_PRODUCTION',
        readyForProduction: true,
        arrivedQty: 4,
        expectedQty: 12,
        qrCodes: ['FB-SOFB1042-002'],
      }),
      asRow({
        id: 'd',
        salesOrderId: 'so-1048',
        orderNumber: 'SO-1048',
        label: 'Velvet 520',
        derivedStatus: 'PARTIAL',
        readyForProduction: false,
        arrivedQty: 6,
        expectedQty: 10,
        qrCodes: [],
      }),
    ];
    const partial = filterFabricRowsByPurchasingStatus(rows, 'PARTIAL');
    const groups = groupFabricRowsBySalesOrder(partial);
    expect(groups.map((g) => g.orderNumber).sort()).toEqual(['SO-1048', 'SO-FB1042']);
    expect(groups.find((g) => g.orderNumber === 'SO-FB1042')?.rows.map((r) => r.label)).toEqual([
      'Linen 180 · Natural',
    ]);
  });
});
