import type { PaginatedResponse } from '@maher/types';

/**
 * Next page for Nest `{ data, meta: { page, totalPages } }` lists.
 */
export function getNextPageParamFromMeta<T>(
  lastPage: PaginatedResponse<T>,
): number | undefined {
  const { page, totalPages } = lastPage.meta;
  if (page >= totalPages) return undefined;
  return page + 1;
}

export function getPreviousPageParamFromMeta<T>(
  firstPage: PaginatedResponse<T>,
): number | undefined {
  const { page } = firstPage.meta;
  if (page <= 1) return undefined;
  return page - 1;
}

/** Flatten infinite query pages into a single array. */
export function flattenPaginatedPages<T>(
  pages: PaginatedResponse<T>[] | undefined,
): T[] {
  if (!pages?.length) return [];
  return pages.flatMap((p) => p.data);
}
