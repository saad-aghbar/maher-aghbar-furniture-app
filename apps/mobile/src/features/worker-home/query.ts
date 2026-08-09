import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { getWorkerHome } from './api';

export function useWorkerHomeQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.workerHome(),
    queryFn: getWorkerHome,
    enabled,
    staleTime: 30_000,
  });
}
