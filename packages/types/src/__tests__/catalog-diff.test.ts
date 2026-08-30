import {
  buildCatalogDiff,
  normalizeOrderMeasurements,
  type OrderMeasurement,
} from '../manufacturing-complexity';

describe('Piece 4 catalog diff + measurements', () => {
  it('normalizes mixed measurement shapes', () => {
    const rows = normalizeOrderMeasurements([
      { key: 'arm', label: 'Arm height', value: 55, unit: 'cm', catalogValue: 50 },
      { id: 'leg', nameEn: 'Leg height', value: '12', unit: 'cm' },
    ]);
    expect(rows).toEqual([
      { key: 'arm', label: 'Arm height', value: 55, unit: 'cm', catalogValue: 50 },
      { key: 'leg', label: 'Leg height', value: 12, unit: 'cm', catalogValue: null },
    ]);
  });

  it('emits dim + fabric + measurement rows for MODIFIED', () => {
    const measurements: OrderMeasurement[] = [
      { key: 'arm', label: 'Arm height', value: 55, unit: 'cm', catalogValue: 50 },
    ];
    const rows = buildCatalogDiff({
      complexity: 'MODIFIED',
      catalogDimensions: { width: 220, height: 90, depth: 85 },
      orderDimensions: { width: 240, height: 90, depth: 85 },
      catalogFabricLabel: 'Linen Beige',
      orderFabricLabel: 'Velvet Navy',
      measurements,
    });
    expect(rows.map((r) => r.field)).toEqual(['width', 'fabric', 'measurement:arm']);
    expect(rows[0]).toMatchObject({ from: 220, to: 240, delta: 20 });
    expect(rows[1]).toMatchObject({ from: 'Linen Beige', to: 'Velvet Navy' });
  });

  it('skips fake catalog compare for CUSTOM', () => {
    expect(
      buildCatalogDiff({
        complexity: 'CUSTOM',
        catalogDimensions: { width: 100 },
        orderDimensions: { width: 120 },
        orderFabricLabel: 'X',
      }),
    ).toEqual([]);
  });

  it('returns empty for STANDARD without measurement diffs', () => {
    expect(
      buildCatalogDiff({
        complexity: 'STANDARD',
        catalogDimensions: { width: 180 },
        orderDimensions: { width: 180 },
      }),
    ).toEqual([]);
  });
});
