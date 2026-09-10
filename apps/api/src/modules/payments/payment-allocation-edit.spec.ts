import { planAllocationAmountEdit } from './payment-allocation-edit';

describe('planAllocationAmountEdit', () => {
  it('lets a credit row shrink', () => {
    expect(
      planAllocationAmountEdit({
        currentAlloc: 80,
        nextAmount: 50,
        paymentUnallocated: 20,
        invoiceOutstanding: 40,
      }),
    ).toBe(50);
  });

  it('grows only by free credit and invoice remaining', () => {
    expect(
      planAllocationAmountEdit({
        currentAlloc: 50,
        nextAmount: 90,
        paymentUnallocated: 20,
        invoiceOutstanding: 40,
      }),
    ).toBe(70);
  });

  it('rejects a non-positive amount', () => {
    expect(
      planAllocationAmountEdit({
        currentAlloc: 50,
        nextAmount: 0,
        paymentUnallocated: 20,
        invoiceOutstanding: 40,
      }),
    ).toBe(0);
  });
});
