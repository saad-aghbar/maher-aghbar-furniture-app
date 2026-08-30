import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateKeys, queryKeys } from '@/api/queryKeys';
import {
  flattenPaginatedPages,
  getNextPageParamFromMeta,
} from '@/api/infinite';
import {
  blockTask,
  completeTask,
  getTask,
  listCompletedDealers,
  listTasks,
  pauseTask,
  resumeTask,
  startTask,
  type TaskBlockerCategory,
  type TaskListFilters,
} from './api';

export type TasksListQueryFilters = Omit<TaskListFilters, 'page' | 'pageSize'>;

export function useTasksInfiniteQuery(
  filters: TasksListQueryFilters,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: ({ pageParam }) =>
      listTasks({
        ...filters,
        page: pageParam,
        pageSize: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 30_000,
    // Keep the current list visible while segment / search / date filters load.
    placeholderData: keepPreviousData,
    meta: { skipGlobalErrorToast: true },
  });
}

export function useCompletedDealersQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.tasks.all, 'completed-dealers'] as const,
    queryFn: listCompletedDealers,
    enabled,
    staleTime: 60_000,
    meta: { skipGlobalErrorToast: true },
  });
}

export function flattenTasksPages(
  data: ReturnType<typeof useTasksInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useTaskQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id ?? ''),
    queryFn: () => getTask(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
    meta: { skipGlobalErrorToast: true },
  });
}

async function invalidateTaskQueries(
  qc: ReturnType<typeof useQueryClient>,
  taskId?: string,
) {
  for (const key of invalidateKeys.afterTaskMutation(taskId)) {
    await qc.invalidateQueries({ queryKey: key });
  }
}

export function useStartTaskMutation(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startTask(taskId),
    onSuccess: () => invalidateTaskQueries(qc, taskId),
  });
}

export function usePauseTaskMutation(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pauseTask(taskId),
    onSuccess: () => invalidateTaskQueries(qc, taskId),
  });
}

export function useResumeTaskMutation(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resumeTask(taskId),
    onSuccess: () => invalidateTaskQueries(qc, taskId),
  });
}

export function useCompleteTaskMutation(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: {
      notes?: string;
      photoDocumentIds?: string[];
      idempotencyKey?: string;
      confirmedPackageLabels?: string[];
      packagingProblem?: boolean;
    }) => completeTask(taskId, body ?? {}),
    onSuccess: () => invalidateTaskQueries(qc, taskId),
  });
}

export function useBlockTaskMutation(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      category: TaskBlockerCategory;
      reason: string;
      idempotencyKey?: string;
    }) => blockTask(taskId, body),
    onSuccess: () => invalidateTaskQueries(qc, taskId),
  });
}
