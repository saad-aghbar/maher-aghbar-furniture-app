import {
  pickDefaultLocationId,
  locationPickerLabel,
  warehouseBinLine,
  sortBinsForPicker,
} from '../pickDefaultLocation';

describe('pickDefaultLocationId', () => {
  const bins = [
    { id: 'a', code: 'A1', isDefault: false },
    { id: 'main', code: 'MAIN', isDefault: true },
    { id: 'off', code: 'OFF', isDefault: false, isActive: false },
  ];

  it('keeps the current active selection', () => {
    expect(pickDefaultLocationId(bins, 'a')).toBe('a');
  });

  it('falls back to the default bin', () => {
    expect(pickDefaultLocationId(bins)).toBe('main');
  });

  it('skips inactive bins when choosing a default', () => {
    expect(pickDefaultLocationId([{ id: 'off', isActive: false }, { id: 'b' }])).toBe('b');
  });
});

describe('sortBinsForPicker', () => {
  it('puts the default bin first, then code order', () => {
    const rows = sortBinsForPicker([
      { id: 'a', code: 'ASSEMBLY', isDefault: false },
      { id: 'c', code: 'CARPENTRY', isDefault: false },
      { id: 'm', code: 'SEMI-MAIN', isDefault: true },
    ]);
    expect(rows.map((row) => row.id)).toEqual(['m', 'a', 'c']);
  });
});

describe('warehouseBinLine', () => {
  it('joins warehouse and bin', () => {
    expect(warehouseBinLine('Raw', 'MAIN')).toBe('Raw · \u2066MAIN\u2069');
  });

  it('returns warehouse alone when the bin is empty', () => {
    expect(warehouseBinLine('Raw', '  ')).toBe('Raw');
  });
});

describe('locationPickerLabel', () => {
  it('shows code and name together', () => {
    expect(locationPickerLabel({ id: '1', code: 'RAW-MAIN', name: 'Main floor' })).toBe(
      'RAW-MAIN — Main floor',
    );
  });

  it('does not duplicate when name equals code', () => {
    expect(locationPickerLabel({ id: '1', code: 'A1', name: 'A1' })).toBe('A1');
  });
});
