import {
  isAdminHomeEmpty,
  primaryKpis,
  secondaryKpis,
  selectUrgentAlert,
  visibleMetrics,
} from '../selectUrgentAlert';
import { adminHomeEmptyFixture, adminHomeSuccessFixture } from '../fixtures';

describe('selectUrgentAlert', () => {
  it('prioritizes late orders over other signals', () => {
    expect(selectUrgentAlert(adminHomeSuccessFixture)).toEqual({
      kind: 'late',
      count: 7,
    });
  });

  it('falls through to urgent tasks when no late orders', () => {
    expect(
      selectUrgentAlert({
        ...adminHomeSuccessFixture,
        delayedOrders: 0,
      }),
    ).toEqual({ kind: 'urgentTasks', count: 2 });
  });

  it('returns null when all clear', () => {
    expect(selectUrgentAlert(adminHomeEmptyFixture)).toBeNull();
  });
});

describe('primaryKpis / secondaryKpis', () => {
  it('exposes Screen 03 primary 2×2 KPIs', () => {
    const metrics = primaryKpis(adminHomeSuccessFixture);
    expect(metrics).toHaveLength(4);
    expect(metrics.map((m) => m.key)).toEqual([
      'newOrders',
      'ordersInProduction',
      'ordersNearingDelivery',
      'delayedOrders',
    ]);
    expect(metrics.find((m) => m.key === 'delayedOrders')?.emphasize).toBe('warning');
  });

  it('exposes secondary low stock + receivables', () => {
    const metrics = secondaryKpis(adminHomeSuccessFixture);
    expect(metrics).toHaveLength(2);
    expect(metrics.map((m) => m.key)).toEqual([
      'lowStockItems',
      'outstandingReceivables',
    ]);
    expect(metrics.find((m) => m.key === 'outstandingReceivables')?.isMoney).toBe(true);
  });

  it('visibleMetrics combines primary and secondary', () => {
    expect(visibleMetrics(adminHomeSuccessFixture)).toHaveLength(6);
  });

  it('detects empty home', () => {
    expect(isAdminHomeEmpty(adminHomeEmptyFixture)).toBe(true);
    expect(isAdminHomeEmpty(adminHomeSuccessFixture)).toBe(false);
  });
});
