import { buildSupplierStatementLedger, parseStatementBound } from './supplier-statement';

describe('supplier statement range', () => {
  it('parses date-only bounds as start and end of day', () => {
    const from = parseStatementBound('2026-02-01');
    const to = parseStatementBound('2026-02-28', true);
    expect(from?.getHours()).toBe(0);
    expect(to?.getHours()).toBe(23);
  });

  it('rolls activity before from into the opening balance', () => {
    const ledger = buildSupplierStatementLedger({
      from: new Date('2026-02-01T00:00:00.000Z'),
      to: new Date('2026-02-28T23:59:59.999Z'),
      entries: [
        {
          date: new Date('2026-01-15T00:00:00.000Z'),
          reference: 'SINV-1',
          debit: 100,
          credit: 0,
          description: 'Invoice',
        },
        {
          date: new Date('2026-01-20T00:00:00.000Z'),
          reference: 'SPAY-1',
          debit: 0,
          credit: 40,
          description: 'Payment',
        },
        {
          date: new Date('2026-02-10T00:00:00.000Z'),
          reference: 'SINV-2',
          debit: 25,
          credit: 0,
          description: 'Invoice',
        },
      ],
    });
    expect(ledger.openingBalance).toBe(60);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.closingBalance).toBe(85);
  });
});
