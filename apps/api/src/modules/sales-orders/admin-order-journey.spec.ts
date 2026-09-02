import {
  classifyAdminOrderJourneyBucket,
  emptyJourneyCounts,
  isExecutionStartedFromPos,
  isReleasedToFactoryFromPos,
  tallyJourneyCounts,
  type AdminOrderJourneyBucket,
  type JourneyClassifyInput,
} from './admin-order-journey';

describe('admin-order-journey classifier', () => {
  it('keeps unreleased READY_FOR_PRODUCTION in preparing', () => {
    expect(
      classifyAdminOrderJourneyBucket({
        status: 'READY_FOR_PRODUCTION',
        productionOrders: [{ status: 'PLANNED', releasedToFactoryAt: null }],
      }),
    ).toBe('preparing');
  });

  it('moves released but not started to ready_to_start', () => {
    expect(
      classifyAdminOrderJourneyBucket({
        status: 'READY_FOR_PRODUCTION',
        productionOrders: [
          {
            status: 'READY',
            releasedToFactoryAt: new Date('2026-09-01T08:00:00Z'),
            actualStartDate: null,
          },
        ],
      }),
    ).toBe('ready_to_start');
  });

  it('moves first actual start to in_production', () => {
    expect(
      classifyAdminOrderJourneyBucket({
        status: 'IN_PRODUCTION',
        productionOrders: [
          {
            status: 'IN_PROGRESS',
            releasedToFactoryAt: new Date('2026-09-01T08:00:00Z'),
            actualStartDate: new Date('2026-09-02T08:00:00Z'),
          },
        ],
      }),
    ).toBe('in_production');
  });

  it('classifies packaging-complete as ready_to_ship', () => {
    expect(
      classifyAdminOrderJourneyBucket({
        status: 'READY_FOR_DELIVERY',
        productionOrders: [{ status: 'READY_FOR_DELIVERY', releasedToFactoryAt: new Date() }],
      }),
    ).toBe('ready_to_ship');
  });

  it('classifies truck departed as shipped', () => {
    expect(
      classifyAdminOrderJourneyBucket({
        status: 'READY_FOR_DELIVERY',
        deliveryStatus: 'OUT_FOR_DELIVERY',
      }),
    ).toBe('shipped');
  });

  it('classifies dealer confirm as delivered', () => {
    expect(
      classifyAdminOrderJourneyBucket({
        status: 'DELIVERED',
        deliveryStatus: 'DELIVERED',
      }),
    ).toBe('delivered');
  });

  it('tallies all == sum of buckets', () => {
    const rows: JourneyClassifyInput[] = [
      { status: 'DRAFT', productionOrders: [] },
      {
        status: 'READY_FOR_PRODUCTION',
        productionOrders: [{ status: 'READY', releasedToFactoryAt: new Date() }],
      },
      {
        status: 'IN_PRODUCTION',
        productionOrders: [{ status: 'IN_PROGRESS', actualStartDate: new Date() }],
      },
    ];
    const counts = tallyJourneyCounts(rows);
    expect(counts.all).toBe(3);
    expect(counts.preparing).toBe(1);
    expect(counts.ready_to_start).toBe(1);
    expect(counts.in_production).toBe(1);
    expect(emptyJourneyCounts().all).toBe(0);
  });

  it('released / started helpers match classifier inputs', () => {
    const released: AdminOrderJourneyBucket = 'ready_to_start';
    expect(released).toBe('ready_to_start');
    expect(
      isReleasedToFactoryFromPos([{ releasedToFactoryAt: new Date(), status: 'READY' }]),
    ).toBe(true);
    expect(isExecutionStartedFromPos([{ status: 'PLANNED' }])).toBe(false);
    expect(isExecutionStartedFromPos([{ actualStartDate: new Date() }])).toBe(true);
  });
});
