/**
 * COUNT = DATASET regression — journeyCounts must not depend on loaded page size
 * or client-side filtering of loaded rows.
 */

import {
  classifyAdminOrderJourneyBucket,
  emptyJourneyCounts,
  tallyJourneyCounts,
  type JourneyClassifyInput,
} from './admin-order-journey';

function row(partial: JourneyClassifyInput & { id: string }): JourneyClassifyInput & {
  id: string;
} {
  return {
    status: 'CONFIRMED',
    deliveryStatus: null,
    productionOrders: [],
    ...partial,
  };
}

const DATASET: Array<JourneyClassifyInput & { id: string }> = [
  row({ id: '1', status: 'CONFIRMED' }),
  row({ id: '2', status: 'CONFIRMED' }),
  row({
    id: '3',
    status: 'READY_FOR_PRODUCTION',
    productionOrders: [
      { releasedToFactoryAt: '2026-08-20T08:00:00.000Z', status: 'READY' },
    ],
  }),
  row({
    id: '4',
    status: 'IN_PRODUCTION',
    productionOrders: [
      {
        releasedToFactoryAt: '2026-08-18T08:00:00.000Z',
        actualStartDate: '2026-08-21T07:30:00.000Z',
        status: 'IN_PROGRESS',
      },
    ],
  }),
  row({
    id: '5',
    status: 'READY_FOR_DELIVERY',
    productionOrders: [
      {
        releasedToFactoryAt: '2026-08-10T08:00:00.000Z',
        actualStartDate: '2026-08-11T07:00:00.000Z',
        status: 'READY_FOR_DELIVERY',
      },
    ],
  }),
  row({
    id: '6',
    status: 'OUT_FOR_DELIVERY',
    deliveryStatus: 'OUT_FOR_DELIVERY',
    productionOrders: [
      {
        releasedToFactoryAt: '2026-08-01T08:00:00.000Z',
        actualStartDate: '2026-08-02T07:00:00.000Z',
        status: 'COMPLETED',
      },
    ],
  }),
  row({
    id: '7',
    status: 'DELIVERED',
    deliveryStatus: 'DELIVERED',
    productionOrders: [
      {
        releasedToFactoryAt: '2026-07-01T08:00:00.000Z',
        actualStartDate: '2026-07-02T07:00:00.000Z',
        status: 'COMPLETED',
      },
    ],
  }),
  ...Array.from({ length: 13 }, (_, i) =>
    row({ id: `p${i}`, status: 'CONFIRMED' }),
  ),
];

describe('COUNT=DATASET journeyCounts regression', () => {
  const fullCounts = tallyJourneyCounts(DATASET);

  it('full tally: all equals sum of lane buckets', () => {
    const sum =
      fullCounts.preparing +
      fullCounts.ready_to_start +
      fullCounts.in_production +
      fullCounts.ready_to_ship +
      fullCounts.shipped +
      fullCounts.delivered;
    expect(fullCounts.all).toBe(DATASET.length);
    expect(fullCounts.all).toBe(sum);
  });

  it('pagination does not inflate counts — page slice tallies ≠ server journeyCounts', () => {
    const page1 = DATASET.slice(0, 5);
    const page1Local = tallyJourneyCounts(page1);
    expect(page1Local.all).toBe(5);
    expect(page1Local.all).not.toBe(fullCounts.all);
    expect(fullCounts.all).toBe(DATASET.length);
  });

  it('scrolling (accumulating pages) must not be used as chip counts', () => {
    const loadedAfterScroll = DATASET.slice(0, 15);
    const clientMistake = tallyJourneyCounts(loadedAfterScroll);
    expect(clientMistake.preparing).not.toBe(fullCounts.preparing);
    expect(fullCounts.preparing).toBe(
      DATASET.filter(
        (r) => classifyAdminOrderJourneyBucket(r) === 'preparing',
      ).length,
    );
  });

  it('switching lanes: filter scope size equals meta count for that bucket', () => {
    for (const bucket of [
      'preparing',
      'ready_to_start',
      'in_production',
      'ready_to_ship',
      'shipped',
      'delivered',
    ] as const) {
      const scoped = DATASET.filter(
        (r) => classifyAdminOrderJourneyBucket(r) === bucket,
      );
      expect(scoped.length).toBe(fullCounts[bucket]);
    }
  });

  it('unrelated counts unchanged when focusing a lane (same meta object)', () => {
    const focused = 'in_production';
    const before = { ...fullCounts };
    const scoped = DATASET.filter(
      (r) => classifyAdminOrderJourneyBucket(r) === focused,
    );
    expect(scoped.length).toBe(before.in_production);
    expect(fullCounts.preparing).toBe(before.preparing);
    expect(fullCounts.shipped).toBe(before.shipped);
    expect(fullCounts.all).toBe(before.all);
  });

  it('emptyJourneyCounts baseline', () => {
    expect(emptyJourneyCounts()).toEqual({
      all: 0,
      preparing: 0,
      ready_to_start: 0,
      in_production: 0,
      ready_to_ship: 0,
      shipped: 0,
      delivered: 0,
    });
  });
});
