import { describe, expect, it } from 'vitest';

function mergeLine<T extends { id: string }>(
  items: T[],
  lineId: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => (item.id === lineId ? { ...item, ...patch } : item));
}

describe('factory line desk merge', () => {
  it('patches only the selected line', () => {
    const next = mergeLine(
      [
        { id: 'a', productName: 'Chair', quantity: 1 },
        { id: 'b', productName: 'Table', quantity: 2 },
      ],
      'b',
      { quantity: 4 },
    );
    expect(next[0]?.quantity).toBe(1);
    expect(next[1]).toEqual({ id: 'b', productName: 'Table', quantity: 4 });
  });
});
