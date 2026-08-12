import { comparePriority, sortWithFairness } from '../priority-fairness';
import type { PrioritySortItem } from '../types';

function item(partial: Partial<PrioritySortItem> & Pick<PrioritySortItem, 'id' | 'customerId'>): PrioritySortItem {
  return {
    isPinned: false,
    priority: 'NORMAL',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...partial,
  };
}

describe('priority-fairness', () => {
  it('orders pinned before unpinned, then URGENT>HIGH>NORMAL>LOW', () => {
    const items = [
      item({ id: '1', customerId: 'A', priority: 'LOW' }),
      item({ id: '2', customerId: 'A', priority: 'URGENT' }),
      item({ id: '3', customerId: 'A', priority: 'NORMAL', isPinned: true }),
      item({ id: '4', customerId: 'A', priority: 'HIGH' }),
    ];
    const sorted = sortWithFairness(items).map((x) => x.id);
    expect(sorted).toEqual(['3', '2', '4', '1']);
  });

  it('uses committed then requested then createdAt then id', () => {
    const a = item({
      id: 'a',
      customerId: 'X',
      requestedDeliveryDate: new Date('2026-09-10T00:00:00.000Z'),
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
    });
    const b = item({
      id: 'b',
      customerId: 'X',
      committedDeliveryDate: new Date('2026-09-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
    });
    const c = item({
      id: 'c',
      customerId: 'X',
      committedDeliveryDate: new Date('2026-09-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(comparePriority(b, a)).toBeLessThan(0);
    expect(comparePriority(c, b)).toBeLessThan(0);
  });

  it('interleaves equal-priority work across dealers', () => {
    const items = [
      item({ id: 'a1', customerId: 'A', createdAt: new Date('2026-08-01T01:00:00.000Z') }),
      item({ id: 'a2', customerId: 'A', createdAt: new Date('2026-08-01T02:00:00.000Z') }),
      item({ id: 'a3', customerId: 'A', createdAt: new Date('2026-08-01T03:00:00.000Z') }),
      item({ id: 'b1', customerId: 'B', createdAt: new Date('2026-08-01T01:30:00.000Z') }),
      item({ id: 'b2', customerId: 'B', createdAt: new Date('2026-08-01T02:30:00.000Z') }),
    ];
    const sorted = sortWithFairness(items).map((x) => x.id);
    // Round-robin A/B — not all A before any B
    expect(sorted).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
  });

  it('is deterministic for the same input', () => {
    const items = [
      item({ id: 'z', customerId: 'C', priority: 'HIGH' }),
      item({ id: 'y', customerId: 'B', priority: 'HIGH' }),
      item({ id: 'x', customerId: 'A', priority: 'HIGH' }),
    ];
    expect(sortWithFairness(items).map((i) => i.id)).toEqual(
      sortWithFairness(items).map((i) => i.id),
    );
  });
});
