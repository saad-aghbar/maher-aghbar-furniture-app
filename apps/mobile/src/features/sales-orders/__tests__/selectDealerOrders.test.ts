import {
  countDealerOrderStamps,
  filterByDealerOrderTile,
  filterByDealerOrdersRail,
  railStopsForTile,
  selectOrderStationStub,
} from '../selectDealerOrders';
import type { StageCountable } from '../stageCounts';

function row(overrides: Partial<StageCountable> & { progressPercent?: number } = {}): StageCountable & {
  progressPercent?: number;
} {
  return {
    status: 'IN_PRODUCTION',
    deliveryStatus: null,
    kind: 'order',
    ...overrides,
  };
}

describe('selectDealerOrders', () => {
  it('counts 2×2 stamps from dealer desk buckets', () => {
    const stamps = countDealerOrderStamps([
      row({ status: 'IN_PRODUCTION' }),
      row({ status: 'CONFIRMED' }),
      row({ status: 'READY_FOR_DELIVERY', deliveryStatus: 'READY' }),
      row({ status: 'IN_PRODUCTION', deliveryStatus: 'OUT_FOR_DELIVERY' }),
      row({ status: 'NEEDS_INFORMATION', kind: 'rfq' }),
      row({ status: 'SUBMITTED', kind: 'rfq' }),
      row({ status: 'DRAFT', kind: 'rfq' }),
      row({ status: 'DELIVERED', deliveryStatus: 'DELIVERED' }),
    ]);
    expect(stamps.active).toBe(7);
    expect(stamps.production).toBe(2);
    expect(stamps.ready).toBe(2);
    expect(stamps.attention).toBe(3);
  });

  it('filters stamp tiles without flattening RFQ vs SO', () => {
    const rows = [
      row({ status: 'DRAFT', kind: 'rfq' }),
      row({ status: 'IN_PRODUCTION' }),
      row({ status: 'CONFIRMED' }),
      row({ status: 'READY_FOR_DELIVERY', deliveryStatus: 'READY' }),
      row({ status: 'IN_PRODUCTION', deliveryStatus: 'OUT_FOR_DELIVERY' }),
      row({ status: 'NEEDS_INFORMATION', kind: 'rfq' }),
      row({ status: 'DELIVERED', deliveryStatus: 'DELIVERED' }),
    ];
    expect(filterByDealerOrderTile(rows, 'production')).toHaveLength(2);
    expect(filterByDealerOrderTile(rows, 'ready')).toHaveLength(2);
    expect(filterByDealerOrderTile(rows, 'attention').map((r) => r.status)).toEqual([
      'DRAFT',
      'NEEDS_INFORMATION',
    ]);
    expect(filterByDealerOrderTile(rows, 'active').map((r) => r.status)).toEqual([
      'DRAFT',
      'IN_PRODUCTION',
      'CONFIRMED',
      'READY_FOR_DELIVERY',
      'IN_PRODUCTION',
      'NEEDS_INFORMATION',
    ]);
  });

  it('picks desk rail stops and stage-matches without leaking other desks', () => {
    expect(railStopsForTile(null)).toEqual([]);
    expect(railStopsForTile('active')).toEqual([]);
    expect(railStopsForTile('attention')).toEqual([
      'all',
      'drafts',
      'waiting',
      'needsInformation',
    ]);
    expect(railStopsForTile('production')).toEqual(['all', 'pending', 'production']);
    expect(railStopsForTile('ready')).toEqual(['all', 'ready', 'shipped']);

    const rows = [
      row({ status: 'DRAFT', kind: 'rfq' }),
      row({ status: 'NEEDS_INFORMATION', kind: 'rfq' }),
      row({ status: 'CONFIRMED' }),
      row({ status: 'IN_PRODUCTION' }),
      row({ status: 'READY_FOR_DELIVERY', deliveryStatus: 'READY' }),
      row({ status: 'IN_PRODUCTION', deliveryStatus: 'OUT_FOR_DELIVERY' }),
      row({ status: 'DELIVERED', deliveryStatus: 'DELIVERED' }),
    ];
    const review = filterByDealerOrderTile(rows, 'attention');
    expect(filterByDealerOrdersRail(review, 'all')).toEqual(review);
    expect(filterByDealerOrdersRail(review, 'drafts').map((r) => r.status)).toEqual(['DRAFT']);
    expect(filterByDealerOrdersRail(review, 'production')).toHaveLength(0);

    const line = filterByDealerOrderTile(rows, 'production');
    expect(filterByDealerOrdersRail(line, 'pending')).toHaveLength(1);
    expect(filterByDealerOrdersRail(line, 'production')).toHaveLength(1);

    const out = filterByDealerOrderTile(rows, 'ready');
    expect(filterByDealerOrdersRail(out, 'ready')).toHaveLength(1);
    expect(filterByDealerOrdersRail(out, 'shipped')).toHaveLength(1);
  });

  it('picks a station stub from customer-safe lifecycle', () => {
    expect(selectOrderStationStub(row({ status: 'DRAFT', kind: 'rfq' }))).toEqual({
      kind: 'preparing',
      progressLabel: '—',
    });
    expect(selectOrderStationStub(row({ status: 'NEEDS_INFORMATION', kind: 'rfq' })).kind).toBe(
      'review',
    );
    expect(
      selectOrderStationStub(row({ status: 'IN_PRODUCTION', progressPercent: 42 })),
    ).toEqual({ kind: 'production', progressLabel: '42%' });
    expect(
      selectOrderStationStub(
        row({ status: 'READY_FOR_DELIVERY', deliveryStatus: 'READY', progressPercent: 100 }),
      ).kind,
    ).toBe('ready');
    expect(
      selectOrderStationStub(
        row({ status: 'DELIVERED', deliveryStatus: 'DELIVERED', progressPercent: 100 }),
      ).kind,
    ).toBe('delivered');
  });
});
