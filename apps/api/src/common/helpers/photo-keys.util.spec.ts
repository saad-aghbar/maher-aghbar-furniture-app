import { packPhotoKeys, unpackPhotoKeys } from './photo-keys.util';

describe('photo-keys', () => {
  it('packs a single key as a plain string', () => {
    expect(packPhotoKeys(['a.jpg', '  ', null])).toBe('a.jpg');
  });

  it('packs multiple keys as JSON', () => {
    expect(packPhotoKeys(['a.jpg', 'b.jpg'])).toBe(JSON.stringify(['a.jpg', 'b.jpg']));
  });

  it('unpacks a legacy single key and a JSON array', () => {
    expect(unpackPhotoKeys('a.jpg')).toEqual(['a.jpg']);
    expect(unpackPhotoKeys(JSON.stringify(['a.jpg', 'b.jpg']))).toEqual(['a.jpg', 'b.jpg']);
    expect(unpackPhotoKeys(null)).toEqual([]);
  });
});
