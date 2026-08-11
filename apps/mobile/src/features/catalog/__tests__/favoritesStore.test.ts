import {
  favoritesStorageKey,
  isFavorite,
  parseFavoriteIds,
  serializeFavoriteIds,
  toggleFavoriteId,
} from '../favoritesStore';

describe('favoritesStore', () => {
  it('builds a per-user storage key', () => {
    expect(favoritesStorageKey('user-a')).toBe('dealer.catalog.favorites.v1:user-a');
    expect(favoritesStorageKey('user-b')).not.toBe(favoritesStorageKey('user-a'));
  });

  it('parses favorite ids and ignores junk', () => {
    expect(parseFavoriteIds(null)).toEqual([]);
    expect(parseFavoriteIds('not-json')).toEqual([]);
    expect(parseFavoriteIds('{"a":1}')).toEqual([]);
    expect(parseFavoriteIds('["p1","",2,"p2"]')).toEqual(['p1', 'p2']);
  });

  it('serializes unique ids', () => {
    expect(serializeFavoriteIds(['a', 'a', 'b'])).toBe('["a","b"]');
  });

  it('toggles favorites without mutating input', () => {
    const start = ['p1'];
    const added = toggleFavoriteId(start, 'p2');
    expect(added).toEqual(['p1', 'p2']);
    expect(start).toEqual(['p1']);

    const removed = toggleFavoriteId(added, 'p1');
    expect(removed).toEqual(['p2']);
    expect(isFavorite(removed, 'p2')).toBe(true);
    expect(isFavorite(removed, 'p1')).toBe(false);
  });

  it('ignores empty product ids on toggle', () => {
    expect(toggleFavoriteId(['p1'], '')).toEqual(['p1']);
  });
});
