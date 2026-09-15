import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatSalesOrderItemNumber,
  itemLetterAtIndex,
  nextItemLetter,
  withLineItemLetters,
} from './sales-order-item-number';

describe('sales-order item letters', () => {
  it('assigns A then B', () => {
    expect(itemLetterAtIndex(0)).toBe('A');
    expect(itemLetterAtIndex(1)).toBe('B');
    expect(nextItemLetter([])).toBe('A');
    expect(nextItemLetter(['A'])).toBe('B');
  });

  it('skips letters already used on the order', () => {
    expect(nextItemLetter(['A', 'C'])).toBe('B');
  });

  it('continues to AA after Z', () => {
    expect(itemLetterAtIndex(25)).toBe('Z');
    expect(itemLetterAtIndex(26)).toBe('AA');
    expect(itemLetterAtIndex(27)).toBe('AB');
    const used = Array.from({ length: 26 }, (_, i) => itemLetterAtIndex(i));
    expect(nextItemLetter(used)).toBe('AA');
  });

  it('qty 2 is still one letter (one basket line)', () => {
    const [only] = withLineItemLetters([{ quantity: 2 }]);
    expect(only?.itemLetter).toBe('A');
    expect(withLineItemLetters([{ quantity: 2 }, { quantity: 1 }]).map((row) => row.itemLetter)).toEqual([
      'A',
      'B',
    ]);
  });

  it('formats parent.child factory numbers', () => {
    expect(formatSalesOrderItemNumber('SO-2026-00026', 'a')).toBe('SO-2026-00026.A');
  });

  it('schema unique (salesOrderId, itemLetter) and unique ProductionOrder.number', () => {
    const schema = readFileSync(
      join(__dirname, '../../../../packages/database/prisma/schema.prisma'),
      'utf8',
    );
    expect(schema).toContain('@@unique([salesOrderId, itemLetter])');
    expect(schema).toMatch(/model ProductionOrder[\s\S]*?number\s+String\s+@unique/);
  });
});
