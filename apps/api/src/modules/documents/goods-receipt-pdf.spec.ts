import {
  formatGoodsReceiptUnitCost,
  goodsReceiptPdfColumns,
  goodsReceiptPdfRow,
  hasPresentUnitCost,
} from './goods-receipt-pdf';

const LABELS = {
  description: 'Item',
  ordered: 'Ordered',
  received: 'Received',
  rejected: 'Rejected',
  unitPrice: 'Unit price',
};

describe('goods receipt PDF rows', () => {
  it('omits unit cost when no line has one', () => {
    expect(goodsReceiptPdfColumns(LABELS, [{ unitCost: null }, { unitCost: undefined }])).toEqual([
      'Item',
      'Ordered',
      'Received',
      'Rejected',
    ]);
  });

  it('adds a unit-cost column only when a real cost exists', () => {
    expect(goodsReceiptPdfColumns(LABELS, [{ unitCost: null }, { unitCost: 12.5 }])).toEqual([
      'Item',
      'Ordered',
      'Received',
      'Rejected',
      'Unit price',
    ]);
  });

  it('never writes a fake 0 for a missing unit cost', () => {
    expect(hasPresentUnitCost(null)).toBe(false);
    expect(hasPresentUnitCost(0)).toBe(true);
    expect(formatGoodsReceiptUnitCost(null)).toBe('—');
    expect(formatGoodsReceiptUnitCost(undefined)).toBe('—');
    expect(goodsReceiptPdfRow({
      item: 'Walnut',
      orderedQty: 10,
      receivedQty: 8,
      rejectedQty: 1,
      unitCost: null,
    }, true)).toEqual(['Walnut', '10', '8', '1', '—']);
  });

  it('prints a present unit cost', () => {
    expect(goodsReceiptPdfRow({
      item: 'Walnut',
      orderedQty: 10,
      receivedQty: 10,
      rejectedQty: 0,
      unitCost: 18,
    }, true)).toEqual(['Walnut', '10', '10', '0', '18']);
  });
});
