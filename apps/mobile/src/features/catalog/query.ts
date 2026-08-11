import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  flattenPaginatedPages,
  getNextPageParamFromMeta,
} from '@/api/infinite';
import {
  listBrowseCategories,
  listBrowseProducts,
  listPreviouslyOrderedProducts,
  getBrowseProduct,
  type BrowseProductsFilters,
} from './api';

export type CatalogQueryFilters = Omit<BrowseProductsFilters, 'page' | 'pageSize'>;

export function useBrowseCategoriesQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: () => listBrowseCategories(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCatalogInfiniteQuery(
  filters: CatalogQueryFilters,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.catalog.list(filters),
    queryFn: ({ pageParam }) =>
      listBrowseProducts({
        ...filters,
        page: pageParam,
        pageSize: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 30_000,
    /** Keep previous filter results on screen while the next query loads. */
    placeholderData: keepPreviousData,
  });
}

export function flattenCatalogPages(
  data: ReturnType<typeof useCatalogInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useBrowseProductQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.catalog.detail(id ?? ''),
    queryFn: () => getBrowseProduct(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  });
}

export function usePreviouslyOrderedQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.catalog.previouslyOrdered(),
    queryFn: async () => {
      const res = await listPreviouslyOrderedProducts();
      return res.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** Hydrate favorite product ids into browse products (device favorites). */
export function useFavoriteProductsQuery(ids: readonly string[], enabled: boolean) {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.catalog.detail(id),
      queryFn: () => getBrowseProduct(id),
      enabled: enabled && Boolean(id),
      staleTime: 60_000,
    })),
  });

  const products = queries
    .map((q) => q.data)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const isPending = enabled && ids.length > 0 && queries.some((q) => q.isPending);
  const isError = enabled && ids.length > 0 && queries.every((q) => q.isError);
  const refetch = () => Promise.all(queries.map((q) => q.refetch()));

  return { products, isPending, isError, refetch, queries };
}
