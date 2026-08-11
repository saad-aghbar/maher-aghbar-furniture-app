import {
  formatDimensionsNotes,
  migrateLegacyDimensionsNotes,
  parseDimNumber,
  seedDimensionsFromProduct,
  toRequestCustomMeasurements,
} from '../newOrderMeasurements';

describe('newOrderMeasurements', () => {
  it('parses positive dim numbers', () => {
    expect(parseDimNumber('45')).toBe(45);
    expect(parseDimNumber('0')).toBeUndefined();
    expect(parseDimNumber('')).toBeUndefined();
  });

  it('formats a readable dimensions note', () => {
    expect(
      formatDimensionsNotes({
        width: '160',
        height: '85',
        depth: '95',
        seat: '45',
        custom: [{ id: '1', label: 'Arm', value: '60' }],
      }),
    ).toBe('W 160 × H 85 × D 95 × Seat 45 × Arm 60 cm');
  });

  it('includes seat in API custom measurements', () => {
    expect(
      toRequestCustomMeasurements(
        {
          width: '1',
          height: '',
          depth: '',
          seat: '45',
          custom: [{ id: '1', label: 'Arm', value: '60' }],
        },
        'Seat height (cm)',
      ),
    ).toEqual([
      { label: 'Seat height (cm)', value: '45' },
      { label: 'Arm', value: '60' },
    ]);
  });

  it('seeds from a catalog product', () => {
    const seeded = seedDimensionsFromProduct(
      {
        width: 160,
        height: 85,
        depth: 95,
        seatHeight: 45,
        customMeasurements: [{ nameEn: 'Arm', nameAr: 'ذراع', value: 60 }],
      },
      'en',
    );
    expect(seeded.width).toBe('160');
    expect(seeded.seat).toBe('45');
    expect(seeded.custom[0]?.label).toBe('Arm');
  });

  it('migrates legacy freeform notes', () => {
    expect(migrateLegacyDimensionsNotes('W 160 × H 85 × D 95 × Seat 45 cm')).toEqual({
      width: '160',
      height: '85',
      depth: '95',
      seat: '45',
      custom: [],
    });
  });
});
