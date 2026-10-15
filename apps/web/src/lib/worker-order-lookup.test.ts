import { describe, expect, it } from 'vitest';
import { findWorkerSalesOrder, parseWorkerOrderSegment, workerOrderSegmentOrder } from './worker-order-lookup';

describe('worker order lookup', () => {
  it('tries the requested scope before the others', () => {
    expect(workerOrderSegmentOrder('today')).toEqual(['today', 'open', 'active']);
    expect(parseWorkerOrderSegment('nope')).toBe('open');
  });

  it('finds the parent in a later scope instead of treating a miss as empty', () => {
    const today = [{ salesOrderId: 'so-today' }];
    const open = [{ salesOrderId: 'so-open' }];
    expect(findWorkerSalesOrder(today, 'so-open')).toBeNull();
    expect(findWorkerSalesOrder(open, 'so-open')?.salesOrderId).toBe('so-open');
  });
});
