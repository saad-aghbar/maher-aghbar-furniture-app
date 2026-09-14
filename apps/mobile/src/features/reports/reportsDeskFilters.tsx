import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { EMPTY_COST_FILTER, type CostDesk, type CostFilterState } from './costFilters';

type DeskFilters = Record<CostDesk, CostFilterState>;
type DeskSearch = Record<CostDesk, string>;

const EMPTY_DESKS: DeskFilters = {
  money: { ...EMPTY_COST_FILTER },
  orders: { ...EMPTY_COST_FILTER },
  products: { ...EMPTY_COST_FILTER },
  inventory: { ...EMPTY_COST_FILTER },
  returns: { ...EMPTY_COST_FILTER },
  coverage: { ...EMPTY_COST_FILTER },
};

const EMPTY_SEARCH: DeskSearch = {
  money: '',
  orders: '',
  products: '',
  inventory: '',
  returns: '',
  coverage: '',
};

type ReportsDeskFiltersState = {
  filters: DeskFilters;
  search: DeskSearch;
  setFilter: (desk: CostDesk, next: CostFilterState) => void;
  patchFilter: (desk: CostDesk, patch: Partial<CostFilterState>) => void;
  setSearch: (desk: CostDesk, next: string) => void;
  resetDesk: (desk: CostDesk) => void;
};

const ReportsDeskFiltersContext = createContext<ReportsDeskFiltersState | null>(null);

export function ReportsDeskFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DeskFilters>(EMPTY_DESKS);
  const [search, setSearchState] = useState<DeskSearch>(EMPTY_SEARCH);

  const setFilter = useCallback((desk: CostDesk, next: CostFilterState) => {
    setFilters((prev) => ({ ...prev, [desk]: next }));
  }, []);

  const patchFilter = useCallback((desk: CostDesk, patch: Partial<CostFilterState>) => {
    setFilters((prev) => ({ ...prev, [desk]: { ...prev[desk], ...patch } }));
  }, []);

  const setSearch = useCallback((desk: CostDesk, next: string) => {
    setSearchState((prev) => ({ ...prev, [desk]: next }));
  }, []);

  const resetDesk = useCallback((desk: CostDesk) => {
    setFilters((prev) => ({ ...prev, [desk]: { ...EMPTY_COST_FILTER } }));
    setSearchState((prev) => ({ ...prev, [desk]: '' }));
  }, []);

  const value = useMemo(
    () => ({ filters, search, setFilter, patchFilter, setSearch, resetDesk }),
    [filters, search, setFilter, patchFilter, setSearch, resetDesk],
  );

  return (
    <ReportsDeskFiltersContext.Provider value={value}>{children}</ReportsDeskFiltersContext.Provider>
  );
}

export function useReportsDeskFilters(desk: CostDesk) {
  const ctx = useContext(ReportsDeskFiltersContext);
  if (!ctx) {
    return {
      filter: EMPTY_COST_FILTER,
      search: '',
      setFilter: (_next: CostFilterState) => undefined,
      patchFilter: (_patch: Partial<CostFilterState>) => undefined,
      setSearch: (_next: string) => undefined,
      resetDesk: () => undefined,
    };
  }
  return {
    filter: ctx.filters[desk],
    search: ctx.search[desk],
    setFilter: (next: CostFilterState) => ctx.setFilter(desk, next),
    patchFilter: (patch: Partial<CostFilterState>) => ctx.patchFilter(desk, patch),
    setSearch: (next: string) => ctx.setSearch(desk, next),
    resetDesk: () => ctx.resetDesk(desk),
  };
}
