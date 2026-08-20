import {
  assertDealerHomeInvoiceSafe,
  assertDealerHomeOrderSafe,
  isDealerHomeEmpty,
  mapDealerHomeInvoices,
  mapDealerHomeOrders,
  metricStrip,
  outstandingBalanceNumber,
  selectActiveOrders,
  selectNearDeliveryOrders,
  toDealerHomeInvoiceCard,
  toDealerHomeOrderCard,
} from '../selectDealerHome';
import { dealerHomeEmptyFixture, dealerHomeSuccessFixture } from '../fixtures';

describe('metricStrip', () => {
  it('exposes three compact metrics', () => {
    const metrics = metricStrip(dealerHomeSuccessFixture);
    expect(metrics).toHaveLength(3);
    expect(metrics.map((m) => m.key)).toEqual([
      'activeOrders',
      'ordersInProduction',
      'ordersNearingDelivery',
    ]);
    expect(metrics[0]?.value).toBe(12);
  });
});

describe('isDealerHomeEmpty', () => {
  it('detects empty home', () => {
    expect(isDealerHomeEmpty(dealerHomeEmptyFixture)).toBe(true);
    expect(isDealerHomeEmpty(dealerHomeSuccessFixture)).toBe(false);
  });
});

describe('outstandingBalanceNumber', () => {
  it('parses decimal string balances', () => {
    expect(outstandingBalanceNumber(dealerHomeSuccessFixture)).toBe(18750);
    expect(outstandingBalanceNumber(dealerHomeEmptyFixture)).toBe(0);
  });
});

describe('dealer-safe mapping leak guards', () => {
  it('maps orders without cost/worker fields', () => {
    const cards = mapDealerHomeOrders(dealerHomeSuccessFixture.recentOrders);
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      assertDealerHomeOrderSafe(card);
      expect(card).not.toHaveProperty('manufacturingCost');
      expect(card).not.toHaveProperty('profit');
      expect(card).not.toHaveProperty('workerName');
      expect(card).not.toHaveProperty('assignedWorker');
    }
    expect(JSON.stringify(cards)).not.toMatch(/manufacturingCost|workerName|profit/);
  });

  it('maps invoices without cost/worker fields', () => {
    const cards = mapDealerHomeInvoices(dealerHomeSuccessFixture.recentInvoices);
    expect(cards).toHaveLength(1);
    assertDealerHomeInvoiceSafe(cards[0]!);
    expect(JSON.stringify(cards)).not.toMatch(/manufacturingCost|workerName|costBreakdown/);
  });

  it('throws when order card is polluted with cost fields', () => {
    const base = toDealerHomeOrderCard(dealerHomeSuccessFixture.recentOrders[0]!);
    expect(() =>
      assertDealerHomeOrderSafe({
        ...base,
        // @ts-expect-error intentional leak probe
        manufacturingCost: 99,
      }),
    ).toThrow(/leaked/);
  });

  it('throws when invoice card is polluted with worker fields', () => {
    const base = toDealerHomeInvoiceCard(dealerHomeSuccessFixture.recentInvoices[0]!);
    expect(() =>
      assertDealerHomeInvoiceSafe({
        ...base,
        // @ts-expect-error intentional leak probe
        workerName: 'floor-1',
      }),
    ).toThrow(/leaked/);
  });
});

describe('toDealerHomeOrderCard delivery date', () => {
  it('prefers the requested date when no schedule commitment exists', () => {
    const card = toDealerHomeOrderCard(dealerHomeSuccessFixture.recentOrders[0]!);
    expect(card.isCommittedDate).toBe(false);
    expect(card.deliveryDate).toBe(dealerHomeSuccessFixture.recentOrders[0]!.requiredDeliveryDate);
  });

  it('uses calendarDate as the primary home date and does not treat requested as confirmed', () => {
    const card = toDealerHomeOrderCard({
      ...dealerHomeSuccessFixture.recentOrders[0]!,
      calendarDate: '2026-08-19',
      committedDeliveryDate: '2026-08-19',
      projectedDeliveryDate: '2026-08-21',
      requestedDeliveryDate: '2026-08-18',
    });
    expect(card.deliveryDate).toBe('2026-08-19');
    expect(card.isCommittedDate).toBe(true);
    const requestedOnly = toDealerHomeOrderCard({
      ...dealerHomeSuccessFixture.recentOrders[0]!,
      calendarDate: '2026-08-20',
      committedDeliveryDate: null,
      requestedDeliveryDate: '2026-08-20',
    });
    expect(requestedOnly.isCommittedDate).toBe(false);
    expect(requestedOnly.deliveryDate).toBe('2026-08-20');
  });
});

describe('order carousels', () => {
  it('partitions active vs near-delivery from fixtures', () => {
    const cards = mapDealerHomeOrders(dealerHomeSuccessFixture.recentOrders);
    const active = selectActiveOrders(cards);
    const near = selectNearDeliveryOrders(cards);
    expect(active.length).toBeGreaterThan(0);
    expect(near.some((o) => o.status === 'READY_FOR_DELIVERY')).toBe(true);
  });

  it('empty fixture yields empty carousels', () => {
    const cards = mapDealerHomeOrders(dealerHomeEmptyFixture.recentOrders);
    expect(selectActiveOrders(cards)).toEqual([]);
    expect(selectNearDeliveryOrders(cards)).toEqual([]);
  });
});
