import { bumpQtyValue, formatQty, parseQty, sanitizeQtyInput } from '../qtyStepper';

describe('sanitizeQtyInput', () => {
  it('keeps digits and a single decimal', () => {
    expect(sanitizeQtyInput('12.5')).toBe('12.5');
    expect(sanitizeQtyInput('12,5')).toBe('12.5');
    expect(sanitizeQtyInput('1.2.3')).toBe('1.23');
    expect(sanitizeQtyInput('abc4d')).toBe('4');
  });

  it('allows a trailing decimal while typing', () => {
    expect(sanitizeQtyInput('3.')).toBe('3.');
  });
});

describe('parseQty', () => {
  it('parses finite numbers and treats empty as null', () => {
    expect(parseQty('2.5')).toBe(2.5);
    expect(parseQty('')).toBeNull();
    expect(parseQty('.')).toBeNull();
  });
});

describe('bumpQtyValue', () => {
  it('steps from empty with plus and stays at min with minus', () => {
    expect(bumpQtyValue('', 1, { min: 0 })).toBe('1');
    expect(bumpQtyValue('', -1, { min: 0 })).toBe('0');
    expect(bumpQtyValue('', 1, { min: 0.01, step: 1 })).toBe('1');
  });

  it('clamps to min and max', () => {
    expect(bumpQtyValue('1', -1, { min: 0.01 })).toBe('0.01');
    expect(bumpQtyValue('4', 1, { max: 4.5 })).toBe('4.5');
  });

  it('strips trailing zeros', () => {
    expect(formatQty(2)).toBe('2');
    expect(bumpQtyValue('1.5', 1)).toBe('2.5');
  });
});
