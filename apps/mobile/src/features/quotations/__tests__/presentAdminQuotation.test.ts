import {
  presentableText,
  quotationDraftTotals,
  quotationLineDims,
  quotationLineNet,
  quotationLineSpecs,
  quotationLineTaxRate,
  quotationQtyLabel,
} from '../presentAdminQuotation';

describe('presentableText', () => {
  it('hides empty and dash leftovers', () => {
    expect(presentableText(null)).toBeNull();
    expect(presentableText('')).toBeNull();
    expect(presentableText('  ')).toBeNull();
    expect(presentableText('—')).toBeNull();
    expect(presentableText('-')).toBeNull();
  });

  it('keeps real terms', () => {
    expect(presentableText('Net 30')).toBe('Net 30');
  });
});

describe('quotationQtyLabel', () => {
  it('strips leftover .00 on whole quantities', () => {
    expect(quotationQtyLabel(1)).toBe('1');
    expect(quotationQtyLabel('1.00')).toBe('1');
    expect(quotationQtyLabel(1.5)).toBe('1.5');
  });
});

describe('quotationLineNet', () => {
  it('is unit × qty, never tax-inclusive lineTotal', () => {
    expect(quotationLineNet(110, 1)).toBe(110);
    expect(quotationLineNet('110.00', '1.00')).toBe(110);
  });
});

describe('quotationDraftTotals', () => {
  it('updates subtotal, tax, and total from typed unit prices', () => {
    expect(
      quotationDraftTotals([
        { unitPrice: '100', quantity: 2, taxRate: 0.16 },
        { unitPrice: '50', quantity: 1, taxRate: 0.16 },
      ]),
    ).toEqual({ subtotal: 250, tax: 40, total: 290 });
  });

  it('treats empty / zero prices as 0 so the running total can start from scratch', () => {
    expect(
      quotationDraftTotals([
        { unitPrice: '', quantity: 1, taxRate: 0.16 },
        { unitPrice: '0', quantity: 3, taxRate: 0.16 },
      ]),
    ).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });

  it('keeps a stored 0 tax rate instead of inventing 16%', () => {
    expect(quotationLineTaxRate(0)).toBe(0);
    expect(quotationDraftTotals([{ unitPrice: 100, quantity: 1, taxRate: 0 }])).toEqual({
      subtotal: 100,
      tax: 0,
      total: 100,
    });
  });
});

describe('quotationLineDims / quotationLineSpecs', () => {
  it('hides empty dimension and spec leftovers', () => {
    expect(quotationLineDims({})).toBeNull();
    expect(quotationLineSpecs({})).toBeNull();
  });

  it('joins present values only', () => {
    expect(quotationLineDims({ width: 220, height: 85, depth: 90 })).toBe('220×85×90');
    expect(quotationLineSpecs({ material: 'Oak', fabric: '', color: 'Walnut' })).toBe(
      'Oak / Walnut',
    );
  });
});
