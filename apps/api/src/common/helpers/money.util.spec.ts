import { calcLineTotals, roundMoney } from './money.util';

describe('money.util', () => {
  it('rounds to 3 decimal places', () => {
    expect(roundMoney(1.2)).toBe('1.200');
    expect(roundMoney(10)).toBe('10.000');
  });

  it('calculates percent discount and tax', () => {
    const result = calcLineTotals(2, 100, 'PERCENT', 10, 0.16);
    expect(result.subtotal).toBe('180.000');
    expect(result.taxAmount).toBe('28.800');
    expect(result.lineTotal).toBe('208.800');
  });

  it('calculates amount discount', () => {
    const result = calcLineTotals(1, 50, 'AMOUNT', 5, 0);
    expect(result.subtotal).toBe('45.000');
    expect(result.lineTotal).toBe('45.000');
  });
});
