import { useMemo, useState } from 'react';
import { localizedName } from '@maher/i18n';
import { useDealersListQuery } from '@/features/dealers/query';
import { useLocale } from '@/i18n';
import {
  EMPTY_COST_FILTER,
  type CostDesk,
  type CostFilterOption,
  type CostFilterState,
} from './costFilters';
import { useCostProductsQuery } from './query';
import { useReportsDeskFilters } from './reportsDeskFilters';
import { useReportsPeriod } from './reportsPeriod';

const PRODUCT_DESKS: CostDesk[] = ['money', 'orders', 'products', 'returns'];

export function useCostFilterChrome(desk: CostDesk) {
  const { locale, t } = useLocale();
  const { range, dateBasis } = useReportsPeriod();
  const { filter, setFilter, resetDesk } = useReportsDeskFilters(desk);
  const [draft, setDraft] = useState<CostFilterState>(filter);
  const [filterOpen, setFilterOpen] = useState(false);
  const dealersQuery = useDealersListQuery({ page: 1, pageSize: 80 });
  const loadProducts = PRODUCT_DESKS.includes(desk) && (filterOpen || Boolean(filter.productId));
  const productsQuery = useCostProductsQuery(
    range,
    EMPTY_COST_FILTER,
    loadProducts,
    { pageSize: 80 },
    dateBasis,
  );

  const dealerOptions: CostFilterOption[] = useMemo(
    () =>
      (dealersQuery.data?.data ?? []).map((row) => ({
        id: row.id,
        name: localizedName(locale, row, row.name || row.code),
        code: row.code,
        searchText: [row.name, row.nameEn, row.nameAr, row.nameHe, row.code]
          .filter(Boolean)
          .join(' '),
      })),
    [dealersQuery.data, locale],
  );

  const productOptions: CostFilterOption[] = useMemo(() => {
    const rows = productsQuery.data?.data ?? productsQuery.data?.products ?? [];
    return rows.map((row) => {
      const name = localizedName(locale, row.product, row.product?.sku || row.productId);
      return {
        id: row.productId,
        name,
        code: row.product?.sku ?? undefined,
        searchText: [
          row.product?.nameEn,
          row.product?.nameAr,
          row.product?.nameHe,
          row.product?.sku,
          name,
        ]
          .filter(Boolean)
          .join(' '),
      };
    });
  }, [productsQuery.data, locale]);

  const dealerLabel =
    dealerOptions.find((d) => d.id === filter.customerId)?.name ||
    dealerOptions.find((d) => d.id === draft.customerId)?.name ||
    t('accounting.allCustomers');

  const productLabel =
    productOptions.find((d) => d.id === filter.productId)?.name ||
    productOptions.find((d) => d.id === draft.productId)?.name ||
    t('accounting.allProducts');

  return {
    filter,
    setFilter,
    resetDesk,
    draft,
    setDraft,
    filterOpen,
    setFilterOpen,
    dealerOptions,
    productOptions,
    dealerLabel,
    productLabel,
    openFilters: () => {
      setDraft(filter);
      setFilterOpen(true);
    },
    apply: () => {
      setFilter(draft);
      setFilterOpen(false);
    },
    reset: () => {
      setDraft(EMPTY_COST_FILTER);
      resetDesk();
      setFilterOpen(false);
    },
  };
}
