import {
  acceptedReceiptQty,
  isOverReceipt,
  receiptLineExtendedCost,
  remainingOrderedQty,
} from './goods-receipt-cost';
import { purchaseVariance } from './purchase-order-presentation';

describe('goods-receipt qty helpers', () => {
  it('acceptedReceiptQty nets rejected', () => {
    expect(acceptedReceiptQty(60, 5)).toBe(55);
    expect(acceptedReceiptQty(10, 10)).toBe(0);
    expect(acceptedReceiptQty(0, 0)).toBe(0);
  });

  it('remainingOrderedQty never negative', () => {
    expect(remainingOrderedQty(100, 60)).toBe(40);
    expect(remainingOrderedQty(100, 100)).toBe(0);
    expect(remainingOrderedQty(100, 120)).toBe(0);
  });

  it('isOverReceipt blocks exceeding remaining', () => {
    expect(isOverReceipt(41, 40)).toBe(true);
    expect(isOverReceipt(40, 40)).toBe(false);
    expect(isOverReceipt(40.0000001, 40)).toBe(false); // within eps
  });

  it('receiptLineExtendedCost', () => {
    expect(receiptLineExtendedCost(12.5, 8)).toBe(100);
    expect(receiptLineExtendedCost(null, 8)).toBeNull();
    expect(receiptLineExtendedCost(12, 0)).toBeNull();
  });
});

describe('Piece 6 purchase variance (GRN unitCost ≠ PO)', () => {
  it('positive variance when GRN costs more than PO expected', () => {
    const orderedQty = 100;
    const poUnitPrice = 10;
    const receivedQty = 100;
    const grnUnitCost = 12;
    const expectedTotal = orderedQty * poUnitPrice;
    const actualReceivedValue = receivedQty * grnUnitCost;
    const v = purchaseVariance({ expectedTotal, actualReceivedValue });
    expect(v.variance).toBe(200);
    expect(v.expectedTotal).toBe(1000);
    expect(v.actualReceivedValue).toBe(1200);
  });

  it('partial receive values only accepted qty', () => {
    const expectedTotal = 100 * 10;
    const actualReceivedValue = 60 * 11;
    expect(purchaseVariance({ expectedTotal, actualReceivedValue }).variance).toBe(-340);
  });
});
