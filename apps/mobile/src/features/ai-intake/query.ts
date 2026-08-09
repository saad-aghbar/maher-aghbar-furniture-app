import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  flattenPaginatedPages,
  getNextPageParamFromMeta,
} from '@/api/infinite';
import {
  approveAiJob,
  correctAiJobFields,
  createAiJob,
  getAiJob,
  listAiJobs,
  rejectAiJob,
  requestAiManualHandling,
} from './api';

export function useAiJobsInfiniteQuery(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.aiIntake.list({}),
    queryFn: ({ pageParam }) => listAiJobs({ page: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
  });
}

export function flattenAiJobsPages(
  data: ReturnType<typeof useAiJobsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useAiJobQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.aiIntake.detail(id ?? ''),
    queryFn: () => getAiJob(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 5_000,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'UPLOADED' || status === 'QUEUED' || status === 'PROCESSING') {
        return 2000;
      }
      return false;
    },
  });
}

async function invalidateAi(qc: ReturnType<typeof useQueryClient>, id?: string) {
  await qc.invalidateQueries({ queryKey: queryKeys.aiIntake.lists() });
  if (id) await qc.invalidateQueries({ queryKey: queryKeys.aiIntake.detail(id) });
}

export function useCreateAiJobMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAiJob,
    onSuccess: (job) => invalidateAi(qc, job.id),
  });
}

export function useApproveAiJobMutation(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { customerId: string; fieldOverrides?: Record<string, string> }) =>
      approveAiJob(jobId, body),
    onSuccess: () => invalidateAi(qc, jobId),
  });
}

export function useRejectAiJobMutation(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => rejectAiJob(jobId, reason),
    onSuccess: () => invalidateAi(qc, jobId),
  });
}

export function useCorrectAiJobMutation(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldOverrides: Record<string, string>) =>
      correctAiJobFields(jobId, fieldOverrides),
    onSuccess: () => invalidateAi(qc, jobId),
  });
}

export function useManualAiJobMutation(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) => requestAiManualHandling(jobId, notes),
    onSuccess: () => invalidateAi(qc, jobId),
  });
}
