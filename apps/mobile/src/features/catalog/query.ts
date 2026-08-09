import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  flattenPaginatedPages,
  getNextPageParamFromMeta,
} from '@/api/infinite';
import {
  listBrowseCategories,
  listBrowseProducts,
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
