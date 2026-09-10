import { isLegacyHourLunch, DEFAULT_FACTORY_BREAKS, LEGACY_HOUR_LUNCH } from './factory-break';

describe('factory lunch default', () => {
  it('treats exactly 12:00–13:00 as the legacy hour lunch', () => {
    expect(isLegacyHourLunch([LEGACY_HOUR_LUNCH])).toBe(true);
    expect(isLegacyHourLunch([{ start: '12:00', end: '12:30' }])).toBe(false);
    expect(isLegacyHourLunch([{ start: '12:00', end: '13:00' }, { start: '15:00', end: '15:15' }])).toBe(
      false,
    );
    expect(isLegacyHourLunch(null)).toBe(false);
  });

  it('uses 12:00–12:30 as the factory default', () => {
    expect(DEFAULT_FACTORY_BREAKS).toEqual([{ start: '12:00', end: '12:30' }]);
  });
});
