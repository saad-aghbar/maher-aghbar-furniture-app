import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  getCostCoverage,
  getCostCoverageIssues,
  getCostCustomWork,
  getCostInventoryItem,
  getCostInventoryItems,
  getCostInventoryFlow,
  getCostInventorySummary,
  getCostMoney,
  getCostOrders,
  getCostOrderDossier,
  getCostProducts,
  getCostProductProfile,
  getCostVariantProfile,
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
import { costFilterQueryKey, costQueryFromFilter } from './costFilters';
import type { CostDateBasis } from './reportsPeriod';
import type { ReportsDateRange } from './selectReports';

export function costDeskQuery(
  range: ReportsDateRange,
  dateBasis: CostDateBasis,
  filter: CostFilterState,
  extra: Partial<ReportsPeriodQuery> = {},
): ReportsPeriodQuery {
  return {
    from: range.from,
    to: range.to,
    dateBasis,
    ...costQueryFromFilter(filter),
    ...extra,
  };
}

export function reportsQueryStamp(
  range: ReportsDateRange,
  dateBasis: string,
  filter: CostFilterState,
  extra = '',
) {
  return `${range.from}|${range.to}|${dateBasis}|${costFilterQueryKey(filter)}|${extra}`;
}

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

export function useCostMoneyQuery(
  range: ReportsDateRange,
  dateBasis: CostDateBasis,
  filter: CostFilterState,
  enabled: boolean,
) {
  const q = costDeskQuery(range, dateBasis, filter);
  return useQuery({
    queryKey: queryKeys.reports.costMoney(reportsQueryStamp(range, dateBasis, filter)),
    queryFn: () => getCostMoney(q),
    enabled,
  });
}

export function useCostOrdersQuery(
  range: ReportsDateRange,
  filter: CostFilterState,
  enabled: boolean,
  extra: Partial<ReportsPeriodQuery> = {},
  dateBasis: CostDateBasis = 'delivered',
) {
  const q = { ...costDeskQuery(range, dateBasis, filter, extra), page: extra.page ?? 1, pageSize: extra.pageSize ?? 25 };
  return useQuery({
    queryKey: queryKeys.reports.costOrders(reportsQueryStamp(range, dateBasis, filter, extra.q ?? '')),
    queryFn: () => getCostOrders(q),
    enabled,
  });
}

export function useCostProductsQuery(
  range: ReportsDateRange,
  filter: CostFilterState,
  enabled: boolean,
  extra: Partial<ReportsPeriodQuery> = {},
  dateBasis: CostDateBasis = 'delivered',
) {
  const q = costDeskQuery(range, dateBasis, filter, extra);
  return useQuery({
    queryKey: queryKeys.reports.costProducts(reportsQueryStamp(range, dateBasis, filter, extra.q ?? '')),
    queryFn: () => getCostProducts(q),
    enabled,
  });
}

export function useCostProductProfileQuery(
  productId: string | undefined,
  range: ReportsDateRange,
  dateBasis: CostDateBasis,
  enabled: boolean,
) {
  const q = { from: range.from, to: range.to, dateBasis };
  return useQuery({
    queryKey: queryKeys.reports.costProductProfile(productId ?? '', `${range.from}|${range.to}|${dateBasis}`),
    queryFn: () => getCostProductProfile(productId!, q),
    enabled: Boolean(productId) && enabled,
  });
}

export function useCostVariantProfileQuery(
  productId: string | undefined,
  variantId: string | undefined,
  range: ReportsDateRange,
  dateBasis: CostDateBasis,
  enabled: boolean,
) {
  const q = { from: range.from, to: range.to, dateBasis };
  return useQuery({
    queryKey: queryKeys.reports.costVariantProfile(
      productId ?? '',
      variantId ?? '',
      `${range.from}|${range.to}|${dateBasis}`,
    ),
    queryFn: () => getCostVariantProfile(productId!, variantId!, q),
    enabled: Boolean(productId && variantId) && enabled,
  });
}

export function useCostCustomWorkQuery(
  range: ReportsDateRange,
  dateBasis: CostDateBasis,
  enabled: boolean,
) {
  const q = { from: range.from, to: range.to, dateBasis };
  return useQuery({
    queryKey: queryKeys.reports.costCustomWork(`${range.from}|${range.to}|${dateBasis}`),
    queryFn: () => getCostCustomWork(q),
    enabled,
  });
}

export function useCostReturnsQuery(
  range: ReportsDateRange,
  filter: CostFilterState,
  enabled: boolean,
  extra: Partial<ReportsPeriodQuery> = {},
) {
  const q = costDeskQuery(range, 'activity', filter, extra);
  return useQuery({
    queryKey: queryKeys.reports.costReturns(reportsQueryStamp(range, 'activity', filter, extra.q ?? '')),
    queryFn: () => getCostReturns(q),
    enabled,
  });
}

export function useCostCoverageQuery(
  enabled: boolean,
  range?: ReportsDateRange,
  dateBasis: CostDateBasis = 'delivered',
) {
  const q = range ? { from: range.from, to: range.to, dateBasis } : {};
  return useQuery({
    queryKey: queryKeys.reports.costCoverage(
      range ? `${range.from}|${range.to}|${dateBasis}` : 'all',
    ),
    queryFn: () => getCostCoverage(q),
    enabled,
  });
}

export function useCostCoverageIssuesQuery(
  type: string | undefined,
  range: ReportsDateRange,
  dateBasis: CostDateBasis,
  enabled: boolean,
) {
  const q = { from: range.from, to: range.to, dateBasis, type };
  return useQuery({
    queryKey: queryKeys.reports.costCoverageIssues(`${type}|${range.from}|${range.to}|${dateBasis}`),
    queryFn: () => getCostCoverageIssues(q),
    enabled: Boolean(type) && enabled,
  });
}

export function useCostInventorySummaryQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.costInventorySummary(),
    queryFn: getCostInventorySummary,
    enabled,
  });
}

export function useCostInventoryFlowQuery(range: ReportsDateRange, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.costInventoryFlow(`${range.from}|${range.to}`),
    queryFn: () => getCostInventoryFlow({ from: range.from, to: range.to }),
    enabled,
  });
}

export function useCostInventoryItemsQuery(
  filter: CostFilterState,
  enabled: boolean,
  extra: Partial<ReportsPeriodQuery> = {},
) {
  const q = { ...costQueryFromFilter(filter), ...extra };
  return useQuery({
    queryKey: queryKeys.reports.costInventoryItems(`${costFilterQueryKey(filter)}|${extra.q ?? ''}`),
    queryFn: () => getCostInventoryItems(q),
    enabled,
  });
}

export function useCostInventoryItemQuery(
  id: string | undefined,
  range: ReportsDateRange,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.reports.costInventoryItem(id ?? '', `${range.from}|${range.to}`),
    queryFn: () => getCostInventoryItem(id!, { from: range.from, to: range.to }),
    enabled: Boolean(id) && enabled,
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
