import {
  fabricLabelFromSelection,
  normalizeOrderFabrics,
  primaryFabric,
  type OrderFabricSelection,
} from '../fabric-selection';

describe('normalizeOrderFabrics', () => {
  it('keeps a multi-fabric array', () => {
    const rows = normalizeOrderFabrics([
      { key: 'a', type: 'Velvet 302', color: 'Beige', role: 'Main body' },
      { key: 'b', type: 'Bouclé 611', color: 'Cream', role: 'Cushions' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.role).toBe('Main body');
    expect(rows[1]?.type).toBe('Bouclé 611');
  });

  it('derives a single fabric from legacy type/color when array is empty', () => {
    const rows = normalizeOrderFabrics(null, { type: 'Linen', color: 'Sand' });
    expect(rows).toEqual([
      expect.objectContaining({ type: 'Linen', color: 'Sand', key: 'legacy' }),
    ]);
  });

  it('does not invent a fabric from empty strings', () => {
    expect(normalizeOrderFabrics([], { type: '  ', color: '' })).toEqual([]);
  });
});

describe('fabricLabelFromSelection', () => {
  it('joins type · code · color', () => {
    expect(
      fabricLabelFromSelection({ key: '1', type: 'Velvet', code: '302', color: 'Beige' }),
    ).toBe('Velvet · 302 · Beige');
  });
});

describe('primaryFabric', () => {
  it('returns the first selection', () => {
    const fabrics: OrderFabricSelection[] = [
      { key: 'a', type: 'A' },
      { key: 'b', type: 'B' },
    ];
    expect(primaryFabric(fabrics)?.type).toBe('A');
  });
});
