import {
  assertMoneyConservation,
  buildStatementLedger,
  classifyInvoice,
  commercialLinesReady,
  deriveInvoiceStatus,
  initialCommercialPriceStatus,
  money,
  paymentUnallocated,
  recomputeInvoicePaidFromAllocations,
  summarizeDealerFinance,
} from './dealer-finance';

describe('dealer-finance', () => {
  it('paymentUnallocated = amount − allocations', () => {
    expect(paymentUnallocated(20000, [5000])).toBe(15000);
    expect(paymentUnallocated(5000, [5000])).toBe(0);
  });

  it('conserves money', () => {
    expect(
      assertMoneyConservation({ paymentAmount: 20000, allocations: [5000] }),
    ).toBe(true);
  });

  it('never makes invoice remaining negative', () => {
    const r = recomputeInvoicePaidFromAllocations(5000, 20000);
    expect(r.outstandingAmount).toBe(0);
    expect(r.paidAmount).toBe(5000);
    expect(r.status).toBe('PAID');
  });

  it('summarizes amountDue vs availableCredit', () => {
    const s = summarizeDealerFinance({
      invoices: [
        { status: 'ISSUED', outstandingAmount: 5000, dueDate: null },
        { status: 'PAID', outstandingAmount: 0 },
      ],
      payments: [{ amount: 20000, allocations: [{ amount: 5000 }] }],
    });
    expect(s.amountDue).toBe(5000);
    expect(s.availableCredit).toBe(15000);
    expect(s.netPosition).toBe(-10000);
  });

  it('statement opening balance before from', () => {
    const ledger = buildStatementLedger({
      invoices: [
        {
          id: 'i1',
          number: 'INV-1',
          invoiceDate: new Date('2026-01-01'),
          total: 10000,
          status: 'ISSUED',
        },
        {
          id: 'i2',
          number: 'INV-2',
          invoiceDate: new Date('2026-03-01'),
          total: 5000,
          status: 'ISSUED',
        },
      ],
      payments: [
        {
          id: 'p1',
          number: 'PAY-1',
          paymentDate: new Date('2026-02-01'),
          amount: 4000,
        },
      ],
      from: new Date('2026-02-15'),
      to: new Date('2026-12-31'),
    });
    // Before from: +10000 − 4000 = 6000 opening
    expect(ledger.openingBalance).toBe(6000);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.closingBalance).toBe(11000);
  });

  it('commercial gate blocks REQUIRED and zero price', () => {
    expect(
      commercialLinesReady([{ unitPrice: 0, commercialPriceStatus: 'CATALOG' }]).ok,
    ).toBe(false);
    expect(
      commercialLinesReady([{ unitPrice: 100, commercialPriceStatus: 'REQUIRED' }]).ok,
    ).toBe(false);
    expect(
      commercialLinesReady([{ unitPrice: 100, commercialPriceStatus: 'CONFIRMED' }]).ok,
    ).toBe(true);
  });

  it('initialCommercialPriceStatus', () => {
    expect(initialCommercialPriceStatus('STANDARD')).toBe('CATALOG');
    expect(initialCommercialPriceStatus('MODIFIED')).toBe('REQUIRED');
    expect(initialCommercialPriceStatus('CUSTOM')).toBe('REQUIRED');
  });

  it('overdue when dueDate past and outstanding', () => {
    const st = deriveInvoiceStatus({
      status: 'ISSUED',
      total: 1000,
      paidAmount: 0,
      outstandingAmount: 1000,
      dueDate: '2020-01-01',
      now: new Date('2026-01-01'),
    });
    expect(st).toBe('OVERDUE');
    const p = classifyInvoice({
      status: 'ISSUED',
      total: 1000,
      paidAmount: 0,
      outstandingAmount: 1000,
      dueDate: '2020-01-01',
    });
    expect(p.phase).toBe('OVERDUE');
  });

  it('money helper', () => {
    expect(money('12.5')).toBe(12.5);
    expect(money(null)).toBe(0);
  });
});
