import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { getAdminHome, getManagementSummary } from './api';

export function useAdminHomeQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.adminHome(),
    queryFn: getAdminHome,
    enabled,
    staleTime: 30_000,
  });
}

export function useManagementSummaryQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.managementSummary(),
    queryFn: getManagementSummary,
    enabled,
    staleTime: 30_000,
  });
}
