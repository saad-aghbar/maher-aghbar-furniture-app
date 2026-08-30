import {
  classifyPurchaseOrder,
  purchaseVariance,
} from './purchase-order-presentation';

describe('classifyPurchaseOrder', () => {
  it('maps DRAFT with EDIT action', () => {
    const p = classifyPurchaseOrder({ status: 'DRAFT', orderedQty: 10, receivedAcceptedQty: 0 });
    expect(p.phase).toBe('DRAFT');
    expect(p.labelKey).toBe('purchasing.phaseDraft');
    expect(p.tone).toBe('neutral');
    expect(p.progress).toBe(0);
    expect(p.primaryAction).toBe('EDIT');
    expect(p.attentionReason).toBeNull();
  });

  it('maps APPROVED/SENT to ORDERED', () => {
    expect(classifyPurchaseOrder({ status: 'APPROVED' }).phase).toBe('ORDERED');
    expect(classifyPurchaseOrder({ status: 'SENT' }).phase).toBe('ORDERED');
    expect(classifyPurchaseOrder({ status: 'SENT' }).tone).toBe('info');
    expect(classifyPurchaseOrder({ status: 'SENT' }).primaryAction).toBe('RECEIVE');
  });

  it('maps PARTIALLY_RECEIVED with progress', () => {
    const p = classifyPurchaseOrder({
      status: 'PARTIALLY_RECEIVED',
      orderedQty: 100,
      receivedAcceptedQty: 60,
    });
    expect(p.phase).toBe('PARTIALLY_RECEIVED');
    expect(p.progress).toBeCloseTo(0.6, 5);
    expect(p.tone).toBe('warning');
    expect(p.primaryAction).toBe('RECEIVE');
  });

  it('maps RECEIVED / CLOSED / CANCELLED', () => {
    expect(classifyPurchaseOrder({ status: 'RECEIVED', orderedQty: 5, receivedAcceptedQty: 5 }).phase).toBe(
      'RECEIVED',
    );
    expect(classifyPurchaseOrder({ status: 'RECEIVED' }).primaryAction).toBe('VIEW');
    expect(classifyPurchaseOrder({ status: 'CLOSED' }).phase).toBe('CLOSED');
    expect(classifyPurchaseOrder({ status: 'CANCELLED' }).phase).toBe('CANCELLED');
    expect(classifyPurchaseOrder({ status: 'CANCELLED' }).tone).toBe('danger');
  });

  it('flags OVERDUE_ETA when ETA past and remaining', () => {
    const past = new Date(Date.now() - 3 * 86400000);
    const p = classifyPurchaseOrder({
      status: 'PARTIALLY_RECEIVED',
      expectedDeliveryDate: past,
      orderedQty: 100,
      receivedAcceptedQty: 40,
    });
    expect(p.attentionReason).toBe('OVERDUE_ETA');
  });

  it('does not flag overdue when fully received', () => {
    const past = new Date(Date.now() - 3 * 86400000);
    const p = classifyPurchaseOrder({
      status: 'RECEIVED',
      expectedDeliveryDate: past,
      orderedQty: 100,
      receivedAcceptedQty: 100,
    });
    expect(p.attentionReason).toBeNull();
  });

  it('does not flag overdue when ETA is future', () => {
    const future = new Date(Date.now() + 7 * 86400000);
    const p = classifyPurchaseOrder({
      status: 'SENT',
      expectedDeliveryDate: future,
      orderedQty: 50,
      receivedAcceptedQty: 0,
    });
    expect(p.attentionReason).toBeNull();
  });
});

describe('purchaseVariance', () => {
  it('variance = actual − expected', () => {
    expect(purchaseVariance({ expectedTotal: 1000, actualReceivedValue: 1150 })).toEqual({
      expectedTotal: 1000,
      actualReceivedValue: 1150,
      variance: 150,
    });
  });

  it('negative when received under PO price', () => {
    expect(purchaseVariance({ expectedTotal: 500, actualReceivedValue: 420 }).variance).toBe(-80);
  });

  it('treats nullish as 0', () => {
    expect(purchaseVariance({ expectedTotal: NaN as unknown as number, actualReceivedValue: 10 })).toEqual({
      expectedTotal: 0,
      actualReceivedValue: 10,
      variance: 10,
    });
  });
});
