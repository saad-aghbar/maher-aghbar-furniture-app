import {
  presentableText,
  quotationLineDims,
  quotationLineNet,
  quotationLineSpecs,
  quotationQtyLabel,
} from '../presentAdminQuotation';

describe('presentableText', () => {
  it('hides empty and dash leftovers', () => {
    expect(presentableText(null)).toBeNull();
    expect(presentableText('')).toBeNull();
    expect(presentableText('  ')).toBeNull();
    expect(presentableText('—')).toBeNull();
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
  it('is unit × qty, not tax-inclusive lineTotal', () => {
    expect(quotationLineNet(110, 1)).toBe(110);
    expect(quotationLineNet('110.00', '1.00')).toBe(110);
  });

  it('returns null when values are not numbers', () => {
    expect(quotationLineNet('x', 1)).toBeNull();
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
