import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  getDashboardReport,
  getFinancialReport,
  getProductionReport,
  getSalesReport,
} from '@/api/modules/reports';
import type { ReportsDateRange } from './selectReports';

export function useDashboardReportQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.dashboard(),
    queryFn: getDashboardReport,
    enabled,
  });
}

export function useSalesReportQuery(range: ReportsDateRange, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.sales(`${range.from}|${range.to}`),
    queryFn: () => getSalesReport(range),
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
