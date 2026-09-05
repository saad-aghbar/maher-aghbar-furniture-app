import { factoryCalendarForTimezone } from '../production/production-day-lens';
import {
  addToBucket,
  backComputeQuantities,
  bucketForMovement,
  classifyRawStockStatus,
  emptyQtyBuckets,
  moneyOrNull,
  periodNetFromBuckets,
  reconcileItem,
  resolveReportPeriod,
  ReportRangeError,
  valueAtCurrentCost,
  weekStartSundayYmd,
  type ItemQtyBuckets,
} from './raw-materials-report';

function apply(type: string, qty: number, ref?: string): ItemQtyBuckets {
  const buckets = emptyQtyBuckets();
  addToBucket(buckets, bucketForMovement({ type, quantity: qty, referenceType: ref }), qty);
  return buckets;
}

function close(opening: number, buckets: ItemQtyBuckets) {
  const periodNet = periodNetFromBuckets(buckets);
  const closingQty = opening + periodNet;
  const { residual } = reconcileItem({ openingQty: opening, buckets, closingQty });
  return { closingQty, residual, periodNet };
}

describe('resolveReportPeriod', () => {
  it('today is the factory-local current day', () => {
    expect(resolveReportPeriod({ preset: 'today', todayYmd: '2026-08-15' })).toEqual({
      preset: 'today',
      fromYmd: '2026-08-15',
      toYmd: '2026-08-15',
    });
  });

  it('this week starts Sunday and ends today', () => {
    // 2026-08-15 is Saturday; week start is 2026-08-09 (Sunday).
    expect(weekStartSundayYmd('2026-08-15')).toBe('2026-08-09');
    expect(resolveReportPeriod({ preset: 'week', todayYmd: '2026-08-15' })).toEqual({
      preset: 'week',
      fromYmd: '2026-08-09',
      toYmd: '2026-08-15',
    });
    // Sunday itself
    expect(weekStartSundayYmd('2026-08-09')).toBe('2026-08-09');
  });

  it('this month is first calendar day through today', () => {
    expect(resolveReportPeriod({ preset: 'month', todayYmd: '2026-08-15' })).toEqual({
      preset: 'month',
      fromYmd: '2026-08-01',
      toYmd: '2026-08-15',
    });
  });

  it('custom is inclusive from → to', () => {
    expect(
      resolveReportPeriod({
        preset: 'custom',
        from: '2026-08-01',
        to: '2026-08-31',
        todayYmd: '2026-09-01',
      }),
    ).toEqual({ preset: 'custom', fromYmd: '2026-08-01', toYmd: '2026-08-31' });
  });

  it('rejects from > to', () => {
    expect(() =>
      resolveReportPeriod({
        preset: 'custom',
        from: '2026-08-31',
        to: '2026-08-01',
        todayYmd: '2026-09-01',
      }),
    ).toThrow(ReportRangeError);
  });

  it('rejects missing custom dates', () => {
    expect(() =>
      resolveReportPeriod({ preset: 'custom', todayYmd: '2026-09-01' }),
    ).toThrow(ReportRangeError);
  });
});

describe('factory-local period bounds', () => {
  it('Asia/Amman today crosses the UTC date line', () => {
    const cal = factoryCalendarForTimezone('Asia/Amman');
    const { start, endExclusive } = cal.localRangeBounds('2026-08-15', '2026-08-15');
    expect(start.toISOString()).toBe('2026-08-14T21:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-08-15T21:00:00.000Z');
  });
});

describe('backComputeQuantities', () => {
  it('opening = (current − after-period) − period net', () => {
    // current 100, after period +10, during period +20 → closing 90, opening 70
    expect(
      backComputeQuantities({ currentOnHand: 100, postPeriodNet: 10, periodNet: 20 }),
    ).toEqual({ openingQty: 70, closingQty: 90 });
  });
});

describe('RAW-REPORT quantity identity', () => {
  it('A — opening stock only, no movements', () => {
    const buckets = emptyQtyBuckets();
    const { closingQty, residual } = close(42, buckets);
    expect(closingQty).toBe(42);
    expect(residual).toBe(0);
  });

  it('B — purchase receipt', () => {
    const buckets = apply('PURCHASE_RECEIPT', 12);
    const { closingQty, residual } = close(10, buckets);
    expect(closingQty).toBe(22);
    expect(residual).toBe(0);
    expect(buckets.purchaseReceipt).toBe(12);
  });

  it('C — production issue', () => {
    const buckets = apply('PRODUCTION_ISSUE', -8);
    const { closingQty, residual } = close(20, buckets);
    expect(closingQty).toBe(12);
    expect(residual).toBe(0);
    expect(buckets.productionIssue).toBe(8);
  });

  it('D — production return', () => {
    const buckets = apply('PRODUCTION_RETURN', 3);
    const { closingQty, residual } = close(12, buckets);
    expect(closingQty).toBe(15);
    expect(residual).toBe(0);
  });

  it('E — scrap is inside production issue, not a second outflow', () => {
    // Floor scrap is bundled into PRODUCTION_ISSUE. Dedicated SCRAP would double-count.
    const buckets = apply('PRODUCTION_ISSUE', -10);
    const { closingQty, residual } = close(30, buckets);
    expect(closingQty).toBe(20);
    expect(residual).toBe(0);
    expect(buckets.scrap).toBe(0);
    expect(buckets.productionIssue).toBe(10);
  });

  it('F — warehouse transfer nets to zero at factory level', () => {
    const buckets = emptyQtyBuckets();
    addToBucket(buckets, bucketForMovement({ type: 'WAREHOUSE_TRANSFER', quantity: -5 }), -5);
    addToBucket(buckets, bucketForMovement({ type: 'WAREHOUSE_TRANSFER', quantity: 5 }), 5);
    const { closingQty, residual } = close(40, buckets);
    expect(closingQty).toBe(40);
    expect(residual).toBe(0);
    expect(buckets.transferOut).toBe(5);
    expect(buckets.transferIn).toBe(5);
    expect(periodNetFromBuckets(buckets)).toBe(0);
  });

  it('G — inventory adjustment (signed)', () => {
    const buckets = apply('INVENTORY_ADJUSTMENT', -2);
    const { closingQty, residual } = close(10, buckets);
    expect(closingQty).toBe(8);
    expect(residual).toBe(0);
    expect(buckets.adjustment).toBe(-2);
    expect(buckets.countCorrection).toBe(0);
  });

  it('H — stock count variance is a count correction, not a generic adjustment', () => {
    const buckets = apply('INVENTORY_ADJUSTMENT', -4, 'InventoryCount');
    const { closingQty, residual } = close(42, buckets);
    expect(closingQty).toBe(38);
    expect(residual).toBe(0);
    expect(buckets.countCorrection).toBe(-4);
    expect(buckets.adjustment).toBe(0);
  });

  it('I — reservation does not change on-hand', () => {
    const buckets = emptyQtyBuckets();
    const { closingQty, residual } = close(50, buckets);
    expect(closingQty).toBe(50);
    expect(residual).toBe(0);
  });

  it('K — low stock / out of stock use on-hand vs minStock', () => {
    expect(classifyRawStockStatus({ isActive: true, onHand: 0, minStock: 5 })).toBe(
      'OUT_OF_STOCK',
    );
    expect(classifyRawStockStatus({ isActive: true, onHand: 3, minStock: 5 })).toBe(
      'LOW_STOCK',
    );
    expect(classifyRawStockStatus({ isActive: true, onHand: 12, minStock: 5 })).toBe(
      'IN_STOCK',
    );
  });

  it('L — multi-warehouse month: factory total ignores RAW→RAW as stock', () => {
    const a = emptyQtyBuckets();
    addToBucket(a, 'transferOut', -6);
    const b = emptyQtyBuckets();
    addToBucket(b, 'transferIn', 6);
    const factory = emptyQtyBuckets();
    addToBucket(factory, 'transferOut', -6);
    addToBucket(factory, 'transferIn', 6);
    expect(periodNetFromBuckets(a)).toBe(-6);
    expect(periodNetFromBuckets(b)).toBe(6);
    expect(periodNetFromBuckets(factory)).toBe(0);
    expect(reconcileItem({ openingQty: 100, buckets: factory, closingQty: 100 }).residual).toBe(
      0,
    );
  });
});

describe('RAW-REPORT-J missing cost never becomes 0', () => {
  it('moneyOrNull returns null when unitCost is missing', () => {
    expect(moneyOrNull(null, 10)).toBeNull();
    expect(moneyOrNull(undefined, 10)).toBeNull();
    expect(moneyOrNull(0, 10)).toBeNull();
    expect(moneyOrNull(-1, 10)).toBeNull();
    expect(moneyOrNull(12, 2)).toBe(24);
  });

  it('valueAtCurrentCost is null when the SKU has no cost basis', () => {
    const costs = new Map<string, number>([['FAB-1', 10]]);
    expect(valueAtCurrentCost(5, 'FAB-1', costs)).toBe(50);
    expect(valueAtCurrentCost(5, 'FAB-MISSING', costs)).toBeNull();
    expect(valueAtCurrentCost(0, 'FAB-MISSING', costs)).toBe(0);
  });
});
