/**
 * Pure helpers for per-user dealer catalog favorites (device-local).
 * Storage key includes userId so logins on the same device stay isolated.
 */

export const FAVORITES_STORAGE_PREFIX = 'dealer.catalog.favorites.v1';

export function favoritesStorageKey(userId: string): string {
  return `${FAVORITES_STORAGE_PREFIX}:${userId}`;
}

export function parseFavoriteIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function serializeFavoriteIds(ids: string[]): string {
  return JSON.stringify([...new Set(ids)]);
}

export function isFavorite(ids: readonly string[], productId: string): boolean {
  return ids.includes(productId);
}

/** Returns next id list after toggle. Does not mutate input. */
export function toggleFavoriteId(ids: readonly string[], productId: string): string[] {
  if (!productId) return [...ids];
  if (ids.includes(productId)) {
    return ids.filter((id) => id !== productId);
  }
  return [...ids, productId];
}
