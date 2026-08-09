import {
  isDealerHomeEmpty,
  metricStrip,
  outstandingBalanceNumber,
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
