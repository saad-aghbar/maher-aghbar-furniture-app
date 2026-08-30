import { formatMapCoord, normalizeMapCoords, parseMapCoord } from '../mapCoords';

describe('parseMapCoord', () => {
  it('keeps finite numbers', () => {
    expect(parseMapCoord(31.9522)).toBe(31.9522);
  });

  it('parses numeric strings from API decimals', () => {
    expect(parseMapCoord('31.95220')).toBeCloseTo(31.9522);
  });

  it('rejects empty, NaN, and objects', () => {
    expect(parseMapCoord(undefined)).toBeNull();
    expect(parseMapCoord('')).toBeNull();
    expect(parseMapCoord(Number.NaN)).toBeNull();
    expect(parseMapCoord({ s: 1, e: 1, d: [31] })).toBeNull();
  });
});

describe('normalizeMapCoords', () => {
  it('accepts latitude/longitude numbers', () => {
    expect(normalizeMapCoords({ latitude: 31.9, longitude: 35.2 })).toEqual({
      latitude: 31.9,
      longitude: 35.2,
    });
  });

  it('accepts string coords so toFixed can run', () => {
    const next = normalizeMapCoords({ latitude: '31.95220', longitude: '35.23320' });
    expect(next).not.toBeNull();
    expect(formatMapCoord(next!.latitude)).toBe('31.95220');
    expect(formatMapCoord(next!.longitude)).toBe('35.23320');
  });

  it('treats a truthy object with missing latitude as no pin', () => {
    expect(normalizeMapCoords({ latitude: undefined, longitude: 35.2 })).toBeNull();
    expect(normalizeMapCoords({})).toBeNull();
  });
});
