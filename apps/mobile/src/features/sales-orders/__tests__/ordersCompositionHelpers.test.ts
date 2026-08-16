import {
  classifyOrderStage,
  countOrderStages,
  filterByStageFocus,
  matchesStatusChip,
  toggleStageFocus,
} from '../stageCounts';
import { pickHotOrder, scoreHotOrder } from '../pickHotOrder';
import { groupOrdersByDay, groupOrdersFloorBoard } from '../groupOrdersByDay';

describe('orders stageCounts', () => {
  it('classifies statuses by pipeline stage', () => {
    expect(classifyOrderStage({ status: 'CONFIRMED' })).toBe('pending');
    expect(classifyOrderStage({ status: 'IN_PRODUCTION' })).toBe('production');
    expect(classifyOrderStage({ status: 'READY_FOR_DELIVERY' })).toBe('ready');
    expect(classifyOrderStage({ status: 'DELIVERED' })).toBe('delivered');
    expect(
      classifyOrderStage({
        status: 'IN_PRODUCTION',
        deliveryDate: '2020-01-01T00:00:00.000Z',
      }),
    ).toBe('production');
  });

  it('matches status chips without affecting other stages', () => {
    expect(matchesStatusChip({ status: 'CONFIRMED' }, 'pending')).toBe(true);
    expect(matchesStatusChip({ status: 'IN_PRODUCTION' }, 'production')).toBe(true);
    expect(matchesStatusChip({ status: 'READY_FOR_DELIVERY' }, 'ready')).toBe(true);
    expect(matchesStatusChip({ status: 'DELIVERED' }, 'delivered')).toBe(true);
    expect(matchesStatusChip({ status: 'DRAFT' }, 'drafts')).toBe(true);
    expect(matchesStatusChip({ status: 'DRAFT' }, 'pending')).toBe(false);
    expect(matchesStatusChip({ status: 'CONFIRMED' }, 'production')).toBe(false);
    expect(matchesStatusChip({ status: 'CONFIRMED' }, 'all')).toBe(true);
  });

  it('classifies draft separately from pending', () => {
    expect(classifyOrderStage({ status: 'DRAFT' })).toBe('drafts');
    expect(classifyOrderStage({ status: 'SUBMITTED' })).toBe('pending');
  });

  it('counts stages and filters client-side without collapsing other lanes', () => {
    const items = [
      { status: 'CONFIRMED' },
      { status: 'IN_PRODUCTION' },
      { status: 'READY_FOR_DELIVERY' },
      { status: 'IN_PRODUCTION', deliveryDate: '2020-01-01T00:00:00.000Z' },
      { status: 'DELIVERED' },
    ];
    const counts = countOrderStages(items);
    expect(counts.pending).toBe(1);
    expect(counts.production).toBe(2);
    expect(counts.ready).toBe(1);

    const focused = filterByStageFocus(items, 'production');
    expect(focused).toHaveLength(2);
    expect(countOrderStages(items).ready).toBe(1);
    expect(toggleStageFocus('production', 'production')).toBe('all');
    expect(toggleStageFocus('all', 'ready')).toBe('ready');
  });
});

describe('pickHotOrder', () => {
  it('prefers late over calm production', () => {
    const now = Date.parse('2026-08-06T12:00:00.000Z');
    const late = {
      id: 'a',
      number: '1',
      status: 'IN_PRODUCTION',
      title: 'Late',
      imageUrl: null,
      progressPercent: 40,
      deliveryDate: '2026-07-01T00:00:00.000Z',
      priority: 'NORMAL',
    };
    const calm = {
      id: 'b',
      number: '2',
      status: 'CONFIRMED',
      title: 'Calm',
      imageUrl: null,
      progressPercent: 5,
      deliveryDate: '2026-09-01T00:00:00.000Z',
      priority: 'LOW',
    };
    expect(scoreHotOrder(late, now)).toBeGreaterThan(scoreHotOrder(calm, now));
    expect(pickHotOrder([calm, late], now)?.id).toBe('a');
  });
});

describe('groupOrdersByDay', () => {
  it('buckets by delivery day', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const groups = groupOrdersByDay(
      [
        { id: '1', deliveryDate: '2026-08-06T00:00:00.000Z' },
        { id: '2', deliveryDate: '2026-08-07T00:00:00.000Z' },
        { id: '3', deliveryDate: '2026-08-20T00:00:00.000Z' },
        { id: '4', deliveryDate: '2026-07-01T00:00:00.000Z' },
        { id: '5', deliveryDate: null },
      ],
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['past', 'today', 'tomorrow', 'later', 'nodate']);
  });
});

describe('groupOrdersFloorBoard', () => {
  it('splits by arrival day into today then past only', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const groups = groupOrdersFloorBoard(
      [
        { id: '1', arrivedAt: '2026-08-06T09:00:00.000Z' },
        { id: '2', arrivedAt: '2026-08-07T00:00:00.000Z' },
        { id: '3', arrivedAt: '2026-08-20T00:00:00.000Z' },
        { id: '4', arrivedAt: '2026-07-01T00:00:00.000Z' },
        { id: '5', arrivedAt: null },
      ],
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['today', 'past']);
    expect(groups.find((g) => g.key === 'today')?.items.map((i) => i.id)).toEqual(['1']);
    expect(groups.find((g) => g.key === 'past')?.items.map((i) => i.id)).toEqual([
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  it('always returns today and past even when empty', () => {
    const groups = groupOrdersFloorBoard([]);
    expect(groups.map((g) => g.key)).toEqual(['today', 'past']);
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });
});
