export type CatalogBrowseMode = 'all' | 'favorites' | 'ordered';

export const CATALOG_BROWSE_MODES: CatalogBrowseMode[] = ['all', 'favorites', 'ordered'];

/** Filter browse cards to favorites when mode is favorites. */
export function filterProductsForMode<T extends { id: string }>(
  products: T[],
  mode: CatalogBrowseMode,
  favoriteIds: ReadonlySet<string> | readonly string[],
): T[] {
  if (mode !== 'favorites') return products;
  const set = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds);
  return products.filter((p) => set.has(p.id));
}
