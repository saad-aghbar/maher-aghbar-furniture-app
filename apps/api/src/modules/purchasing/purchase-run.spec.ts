import { attachPurchaseRunMeta, classifyPurchaseRun } from './purchase-run';

describe('classifyPurchaseRun', () => {
  it('is DRAFT when any order is still draft', () => {
    expect(classifyPurchaseRun(['DRAFT', 'APPROVED'])).toBe('DRAFT');
    expect(classifyPurchaseRun([])).toBe('DRAFT');
  });

  it('is APPROVED when remaining orders need send', () => {
    expect(classifyPurchaseRun(['APPROVED', 'APPROVED'])).toBe('APPROVED');
    expect(classifyPurchaseRun(['APPROVED', 'SENT'])).toBe('APPROVED');
  });

  it('is SENT after every supplier has been messaged', () => {
    expect(classifyPurchaseRun(['SENT', 'SENT'])).toBe('SENT');
  });

  it('surfaces partial / received / cancelled', () => {
    expect(classifyPurchaseRun(['SENT', 'PARTIALLY_RECEIVED'])).toBe('PARTIALLY_RECEIVED');
    expect(classifyPurchaseRun(['RECEIVED', 'CLOSED'])).toBe('RECEIVED');
    expect(classifyPurchaseRun(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
  });
});

describe('attachPurchaseRunMeta', () => {
  it('exposes run number and supplier count', () => {
    const attached = attachPurchaseRunMeta({
      id: 'po-1',
      purchaseRun: { id: 'run-1', number: 'PRUN-2026-00001', _count: { orders: 3 } },
    });
    expect(attached.runId).toBe('run-1');
    expect(attached.runNumber).toBe('PRUN-2026-00001');
    expect(attached.runSupplierCount).toBe(3);
  });

  it('leaves standalone orders without a run', () => {
    const attached = attachPurchaseRunMeta({ id: 'po-1', purchaseRun: null });
    expect(attached.runId).toBeNull();
    expect(attached.runNumber).toBeNull();
    expect(attached.runSupplierCount).toBeNull();
  });
});
