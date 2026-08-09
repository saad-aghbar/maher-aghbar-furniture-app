import { buildSalesOrderSearchOr } from './build-sales-order-search-or';
import { tryParseSearchDateWindow } from './sales-order-search.util';

describe('sales order search', () => {
  it('parses ISO and English month dates', () => {
    const iso = tryParseSearchDateWindow('2026-08-05');
    expect(iso?.gte.toISOString()).toBe('2026-08-05T00:00:00.000Z');

    const named = tryParseSearchDateWindow('5 Aug 2026');
    expect(named?.gte.toISOString()).toBe('2026-08-05T00:00:00.000Z');

    const month = tryParseSearchDateWindow('Aug', new Date('2026-03-01T00:00:00.000Z'));
    expect(month?.gte.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('builds OR clauses including factory PO and dealer name', () => {
    const or = buildSalesOrderSearchOr('Cedar');
    expect(or.length).toBeGreaterThan(10);
    expect(or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ number: expect.any(Object) }),
        expect.objectContaining({ externalOrderNumber: expect.any(Object) }),
        expect.objectContaining({
          productionOrders: expect.any(Object),
        }),
        expect.objectContaining({
          customer: { nameEn: expect.any(Object) },
        }),
      ]),
    );
  });

  it('adds delivery date window when q is a date', () => {
    const or = buildSalesOrderSearchOr('2026-08-05');
    expect(or.some((clause) => 'requiredDeliveryDate' in clause)).toBe(true);
  });
});
