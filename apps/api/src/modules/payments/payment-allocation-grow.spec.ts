import { planPaymentAllocationGrow } from './payment-allocation-grow';

describe('planPaymentAllocationGrow', () => {
  it('grows by the extra up to this invoice remaining', () => {
    expect(planPaymentAllocationGrow({ extra: 40, invoiceOutstanding: 25 })).toBe(25);
    expect(planPaymentAllocationGrow({ extra: 10, invoiceOutstanding: 25 })).toBe(10);
  });

  it('does not invent an application when nothing is open', () => {
    expect(planPaymentAllocationGrow({ extra: 40, invoiceOutstanding: 0 })).toBe(0);
    expect(planPaymentAllocationGrow({ extra: 0, invoiceOutstanding: 25 })).toBe(0);
  });
});
