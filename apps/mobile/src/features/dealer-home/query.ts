import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { getDealerHome } from './api';

export function useDealerHomeQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.dealerHome(),
    queryFn: getDealerHome,
    enabled,
    staleTime: 30_000,
  });
}
