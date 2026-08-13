import {
  measurementsHaveValues,
  parseInventoryMeasurements,
  starterMeasurements,
} from '../inventoryMeasurementTemplates';

describe('inventory measurement templates', () => {
  it('seeds fabric width and length', () => {
    const rows = starterMeasurements('fabric');
    expect(rows.map((r) => r.nameEn)).toEqual(['Width', 'Length']);
    expect(measurementsHaveValues(rows)).toBe(false);
  });

  it('seeds foam height width depth', () => {
    expect(starterMeasurements('foam').map((r) => r.nameEn)).toEqual([
      'Height',
      'Width',
      'Depth',
    ]);
  });

  it('leaves accessories empty', () => {
    expect(starterMeasurements('accessories')).toEqual([]);
  });

  it('detects filled values', () => {
    expect(
      measurementsHaveValues([{ nameEn: 'Width', nameAr: 'العرض', value: 12, unit: 'cm' }]),
    ).toBe(true);
  });

  it('parses stored json rows', () => {
    const parsed = parseInventoryMeasurements([
      { nameEn: ' Width ', nameAr: ' العرض ', value: 200, unit: 'cm' },
      { nameEn: '', nameAr: 'x', value: 1 },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.nameEn).toBe('Width');
    expect(parsed[0]?.value).toBe(200);
  });
});
