import {
  assertMoneyConservation,
  paymentUnallocated,
  planFifoCreditApplication,
  recomputeInvoicePaidFromAllocations,
  summarizeDealerFinance,
} from './dealer-finance';

/**
 * Piece 7 — advance credit / apply-credit / money conservation (unit).
 * Live P7-L covered by smoke:piece7-dealer-finance-uat.
 */
describe('dealer-finance advance credit', () => {
  it('conserves payment = Σ alloc + unallocated (P7-L shape)', () => {
    const paymentAmount = 20000;
    const allocations = [5000];
    expect(assertMoneyConservation({ paymentAmount, allocations })).toBe(true);
    expect(paymentUnallocated(paymentAmount, allocations)).toBe(15000);
    expect(paymentAmount).toBe(
      allocations.reduce((s, a) => s + a, 0) + paymentUnallocated(paymentAmount, allocations),
    );
  });

  it('conserves multi-invoice split (P7-G) and full allocation', () => {
    expect(assertMoneyConservation({ paymentAmount: 5220, allocations: [2320, 2900] })).toBe(true);
    expect(paymentUnallocated(5220, [2320, 2900])).toBe(0);
    expect(assertMoneyConservation({ paymentAmount: 1000, allocations: [1000] })).toBe(true);
  });

  it('rejects over-allocation in conservation check', () => {
    // Over-alloc would make unallocated clamp to 0 → sum+unalloc ≠ payment
    expect(assertMoneyConservation({ paymentAmount: 100, allocations: [60, 50] })).toBe(false);
  });

  it('apply credit FIFO from oldest payments', () => {
    const plan = planFifoCreditApplication({
      paymentsOldestFirst: [
        { paymentId: 'p-old', unallocated: 3000 },
        { paymentId: 'p-new', unallocated: 12000 },
      ],
      invoiceOutstanding: 8000,
      want: 8000,
    });
    expect(plan.applyAmount).toBe(8000);
    expect(plan.slices).toEqual([
      { paymentId: 'p-old', amount: 3000 },
      { paymentId: 'p-new', amount: 5000 },
    ]);
    expect(plan.invoiceRemainingAfter).toBe(0);
  });

  it('apply credit caps at invoice outstanding (never negative remaining)', () => {
    const plan = planFifoCreditApplication({
      paymentsOldestFirst: [{ paymentId: 'p1', unallocated: 15000 }],
      invoiceOutstanding: 10000,
      want: 15000,
    });
    expect(plan.applyAmount).toBe(10000);
    expect(plan.invoiceRemainingAfter).toBe(0);
    const inv = recomputeInvoicePaidFromAllocations(10000, 10000 + 5000);
    expect(inv.outstandingAmount).toBe(0);
    expect(inv.paidAmount).toBe(10000);
  });

  it('apply credit partial leaves invoice and credit positive (P7-L apply 8k)', () => {
    const plan = planFifoCreditApplication({
      paymentsOldestFirst: [{ paymentId: 'pay-l', unallocated: 15000 }],
      invoiceOutstanding: 10000,
      want: 8000,
    });
    expect(plan.applyAmount).toBe(8000);
    expect(plan.invoiceRemainingAfter).toBe(2000);
    const creditLeft = paymentUnallocated(20000, [5000, 8000]);
    expect(creditLeft).toBe(7000);
    expect(assertMoneyConservation({ paymentAmount: 20000, allocations: [5000, 8000] })).toBe(
      true,
    );
  });

  it('skips exhausted payments and continues FIFO', () => {
    const plan = planFifoCreditApplication({
      paymentsOldestFirst: [
        { paymentId: 'spent', unallocated: 0 },
        { paymentId: 'next', unallocated: 4000 },
      ],
      invoiceOutstanding: 5000,
      want: 5000,
    });
    expect(plan.slices).toEqual([{ paymentId: 'next', amount: 4000 }]);
    expect(plan.applyAmount).toBe(4000);
    expect(plan.invoiceRemainingAfter).toBe(1000);
  });

  it('summarizeDealerFinance separates amountDue vs availableCredit after overpay', () => {
    const s = summarizeDealerFinance({
      invoices: [
        { status: 'PAID', outstandingAmount: 0 },
        { status: 'ISSUED', outstandingAmount: 10000 },
      ],
      payments: [{ amount: 20000, allocations: [{ amount: 5000 }] }],
    });
    expect(s.amountDue).toBe(10000);
    expect(s.availableCredit).toBe(15000);
  });
});
