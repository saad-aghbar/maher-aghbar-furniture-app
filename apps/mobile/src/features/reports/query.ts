import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  getCostCoverage,
  getCostOrders,
  getCostOrderDossier,
  getCostProducts,
  getCostReturnDossier,
  getCostReturns,
  getDashboardReport,
  getFinancialReport,
  getCostLaborRates,
  getCostLaborActuals,
  getProductionReport,
  getSalesReport,
  postCostCoverageBackfill,
  type ReportsPeriodQuery,
} from '@/api/modules/reports';
import type { CostFilterState } from './costFilters';
import { costFilterQueryKey } from './costFilters';
import type { ReportsDateRange } from './selectReports';

function withFilter(range: ReportsDateRange, filter: CostFilterState): ReportsPeriodQuery {
  return {
    from: range.from,
    to: range.to,
    customerId: filter.customerId ?? undefined,
    productId: filter.productId ?? undefined,
    variantId: filter.variantId ?? undefined,
    optionValueId: filter.optionValueId ?? undefined,
    status: filter.status ?? undefined,
  };
}

export function useDashboardReportQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.dashboard(),
    queryFn: getDashboardReport,
    enabled,
  });
}

export function useSalesReportQuery(
  range: ReportsDateRange,
  filter: CostFilterState,
  enabled: boolean,
) {
  const q = withFilter(range, filter);
  return useQuery({
    queryKey: queryKeys.reports.sales(`${range.from}|${range.to}|${costFilterQueryKey(filter)}`),
    queryFn: () => getSalesReport(q),
    enabled,
  });
}

export function useProductionReportQuery(range: ReportsDateRange, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.production(`${range.from}|${range.to}`),
    queryFn: () => getProductionReport(range),
    enabled,
  });
}

export function useFinancialReportQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.financial(),
    queryFn: getFinancialReport,
    enabled,
  });
}

export function useCostOrdersQuery(
  range: ReportsDateRange,
  filter: CostFilterState,
  enabled: boolean,
) {
  const q = withFilter(range, filter);
  return useQuery({
    queryKey: queryKeys.reports.costOrders(`${range.from}|${range.to}|${costFilterQueryKey(filter)}`),
    queryFn: () => getCostOrders(q),
    enabled,
  });
}

export function useCostProductsQuery(
  range: ReportsDateRange,
  filter: CostFilterState,
  enabled: boolean,
) {
  const q = withFilter(range, filter);
  return useQuery({
    queryKey: queryKeys.reports.costProducts(`${range.from}|${range.to}|${costFilterQueryKey(filter)}`),
    queryFn: () => getCostProducts(q),
    enabled,
  });
}

export function useCostReturnsQuery(
  range: ReportsDateRange,
  filter: CostFilterState,
  enabled: boolean,
) {
  const q = withFilter(range, filter);
  return useQuery({
    queryKey: queryKeys.reports.costReturns(`${range.from}|${range.to}|${costFilterQueryKey(filter)}`),
    queryFn: () => getCostReturns(q),
    enabled,
  });
}

export function useCostCoverageQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.costCoverage(),
    queryFn: getCostCoverage,
    enabled,
  });
}

export function useCostOrderDossierQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reports.costDossier(id ?? ''),
    queryFn: () => getCostOrderDossier(id!),
    enabled: Boolean(id),
  });
}

export function useCostReturnDossierQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reports.costReturnDossier(id ?? ''),
    queryFn: () => getCostReturnDossier(id!),
    enabled: Boolean(id),
  });
}

export function useCoverageBackfillMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postCostCoverageBackfill,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

export function useLaborRatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.laborRates(),
    queryFn: getCostLaborRates,
    enabled,
  });
}

export function useLaborActualsQuery(
  range: ReportsDateRange,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.reports.laborActuals(`${range.from}|${range.to}`),
    queryFn: () => getCostLaborActuals({ from: range.from, to: range.to }),
    enabled,
  });
}
