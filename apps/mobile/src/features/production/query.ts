import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCustomers } from '@/api/modules/customers';
import { invalidateKeys, queryKeys } from '@/api/queryKeys';
import {
  flattenPaginatedPages,
  getNextPageParamFromMeta,
} from '@/api/infinite';
import {
  assignTask,
  blockProductionTask,
  ensureProductionPlanTasks,
  getProductionOrder,
  getProductionSummary,
  getProductionDaySummary,
  listAssignableWorkers,
  listProductionOrders,
  pauseProductionTask,
  startProductionOrder,
  returnProductionOrderToPreparing,
  unblockTask,
  updateProductionOrder,
  updateProductionTaskNotes,
  getProductionOrderMaterials,
  getProductionOrderMaterialUsage,
  returnProductionUnusedMaterial,
  getOrderPlanSetup,
  putOrderPlanSetup,
  resyncOrderPlanSetup,
  suggestPlanSchedule,
  type ProductionListBucket,
  type ProductionPriority,
  type ProductionDateMode,
  type ProductionDayFocus,
  type ProductionComplexityFilter,
} from './api';
import {
  patchOrderSetupLine,
  previewOrderSetupLineSeedFromCatalog,
  seedOrderSetupLineFromCatalog,
} from '@/api/modules/sales-orders';
import {
  fetchProductionProblems,
  type ProductionProblemStatus,
} from '@/api/modules/production';
import { invalidateAfterCatalogSeed } from '@/features/sales-orders/catalogTemplateSheet';

export function useProductionSummaryQuery(
  enabled: boolean,
  origin?: 'normal' | 'returned',
  filters?: { complexity?: ProductionComplexityFilter; customerId?: string },
) {
  return useQuery({
    queryKey: [...queryKeys.production.summary(), origin ?? null, filters ?? null] as const,
    queryFn: () => getProductionSummary(origin, filters),
    enabled,
    staleTime: 30_000,
  });
}

export function useProductionDaySummaryQuery(
  filters: {
    onDate: string;
    dateMode?: ProductionDateMode;
    bucket?: ProductionListBucket;
    customerId?: string;
    origin?: 'normal' | 'returned';
    dayFocus?: ProductionDayFocus;
    complexity?: ProductionComplexityFilter;
  },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...queryKeys.production.all, 'day-summary', filters] as const,
    queryFn: () => getProductionDaySummary(filters),
    enabled: enabled && Boolean(filters.onDate),
    staleTime: 15_000,
    placeholderData: (previousData, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[2] as
        | { origin?: 'normal' | 'returned' }
        | undefined;
      if ((previousFilters?.origin ?? null) !== (filters.origin ?? null)) {
        return undefined;
      }
      return previousData;
    },
  });
}

export function useProductionDealersQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.production.all, 'dealers'] as const,
    queryFn: () => listCustomers({ page: 1, pageSize: 100 }),
    enabled,
    staleTime: 60_000,
  });
}

export function useProductionOrdersInfiniteQuery(
  filters: {
    bucket: ProductionListBucket;
    q?: string;
    customerId?: string;
    onDate?: string;
    dateMode?: ProductionDateMode;
    origin?: 'normal' | 'returned';
    dayFocus?: ProductionDayFocus;
    complexity?: ProductionComplexityFilter;
  },
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.production.list(filters),
    queryFn: ({ pageParam }) =>
      listProductionOrders({
        page: pageParam,
        pageSize: 20,
        bucket: filters.bucket,
        q: filters.q,
        customerId: filters.customerId,
        onDate: filters.onDate,
        dateMode: filters.dateMode,
        origin: filters.origin,
        dayFocus: filters.dayFocus,
        complexity: filters.complexity,
        group: 'boards',
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    // Keep the current list on screen while the next bucket/search loads
    placeholderData: keepPreviousData,
  });
}

export function flattenProductionBoardPages(
  data: ReturnType<typeof useProductionOrdersInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

/** @deprecated use flattenProductionBoardPages — hub paginates commercial boards. */
export const flattenProductionOrderPages = flattenProductionBoardPages;

export function useProductionOrderQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.production.detail(id ?? ''),
    queryFn: () => getProductionOrder(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
  });
}

export function useOrderPlanSetupQuery(productionOrderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.production.planSetup(productionOrderId ?? ''),
    queryFn: () => getOrderPlanSetup(productionOrderId!),
    enabled: Boolean(productionOrderId) && enabled,
    staleTime: 10_000,
  });
}

export function usePutOrderPlanSetupMutation(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof putOrderPlanSetup>[1]) =>
      putOrderPlanSetup(productionOrderId, body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: queryKeys.production.planSetup(productionOrderId),
        }),
        qc.invalidateQueries({ queryKey: queryKeys.production.detail(productionOrderId) }),
        qc.invalidateQueries({ queryKey: queryKeys.production.all }),
        qc.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
      ]);
    },
  });
}

export function useResyncOrderPlanSetupMutation(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resyncOrderPlanSetup(productionOrderId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: queryKeys.production.planSetup(productionOrderId),
        }),
        qc.invalidateQueries({ queryKey: queryKeys.production.detail(productionOrderId) }),
        qc.invalidateQueries({ queryKey: queryKeys.production.all }),
      ]);
    },
  });
}

export function useCatalogSeedPreviewQuery(
  salesOrderId: string | undefined,
  lineId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.salesOrders.catalogSeedPreview(salesOrderId ?? '', lineId ?? ''),
    queryFn: () => previewOrderSetupLineSeedFromCatalog(salesOrderId!, lineId!),
    enabled: Boolean(salesOrderId && lineId) && enabled,
    staleTime: 0,
  });
}

export function useSeedFromCatalogMutation(
  salesOrderId: string,
  productionOrderId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { lineId: string; confirmWorkflowChange?: boolean }) =>
      seedOrderSetupLineFromCatalog(salesOrderId, opts.lineId, {
        confirmWorkflowChange: opts.confirmWorkflowChange,
      }),
    onSuccess: (_data, vars) => {
      invalidateAfterCatalogSeed(qc, {
        salesOrderId,
        productionOrderId,
        lineId: vars.lineId,
      });
    },
  });
}

export function useMarkPlanMaterialsReviewedMutation(
  salesOrderId: string,
  productionOrderId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) =>
      patchOrderSetupLine(salesOrderId, lineId, { materialsReviewed: true }),
    onSuccess: () => {
      invalidateAfterCatalogSeed(qc, {
        salesOrderId,
        productionOrderId,
      });
    },
  });
}

export function useAssignableWorkersQuery(
  enabled: boolean,
  q?: string,
  stageDefinitionId?: string,
  opts?: {
    taskId?: string;
    plannedStart?: string;
    plannedCompletion?: string;
  },
) {
  return useQuery({
    queryKey: queryKeys.production.workers(q, stageDefinitionId, opts),
    queryFn: () => listAssignableWorkers(q, stageDefinitionId, opts),
    enabled,
    staleTime: 60_000,
    // Keep prior workers while the assign window changes — avoids sheet/day-board flash.
    placeholderData: keepPreviousData,
  });
}

async function invalidateProduction(
  qc: ReturnType<typeof useQueryClient>,
  orderId?: string,
) {
  await Promise.all(
    invalidateKeys.afterPlacementMutation(orderId).map((key) =>
      qc.invalidateQueries({ queryKey: key as readonly unknown[] }),
    ),
  );
}

export function useAssignTaskMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      taskId: string;
      employeeId: string;
      priority?: ProductionPriority | string;
      plannedStart?: string;
      plannedCompletion?: string;
      estimatedMinutes?: number;
      overtime?: boolean;
      overrideConflict?: boolean;
      acknowledge?: boolean;
      reason?: string;
    }) =>
      assignTask(args.taskId, {
        employeeId: args.employeeId,
        priority: args.priority,
        plannedStart: args.plannedStart,
        plannedCompletion: args.plannedCompletion,
        estimatedMinutes: args.estimatedMinutes,
        overtime: args.overtime,
        overrideConflict: args.overrideConflict,
        acknowledge: args.acknowledge ?? args.overrideConflict,
        reason: args.reason,
      }),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useStartProductionMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { plannedStartDate?: string }) =>
      startProductionOrder(orderId, body),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useReturnProductionToPreparingMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { reason?: string }) =>
      returnProductionOrderToPreparing(orderId, body),
    onSuccess: () => {
      invalidateProduction(qc, orderId);
      void qc.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
    },
  });
}

export function useEnsurePlanTasksMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ensureProductionPlanTasks(orderId),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useUpdateProductionMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      priority?: ProductionPriority | string;
      requiredDeliveryDate?: string;
      plannedStartDate?: string;
      notes?: string;
    }) => updateProductionOrder(orderId, body),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useSuggestPlanScheduleMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plannedStartDate: string) =>
      suggestPlanSchedule(orderId, { plannedStartDate }),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useUnblockTaskMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => unblockTask(taskId),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useUpdateTaskNotesMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { taskId: string; notes: string }) =>
      updateProductionTaskNotes(args.taskId, args.notes),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function usePauseTaskMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => pauseProductionTask(taskId),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useProductionMaterialsQuery(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.production.detail(orderId ?? ''), 'materials'] as const,
    queryFn: () => getProductionOrderMaterials(orderId!),
    enabled: Boolean(orderId) && enabled,
    staleTime: 10_000,
  });
}

export function useProductionMaterialUsageQuery(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.production.detail(orderId ?? ''), 'material-usage'] as const,
    queryFn: () => getProductionOrderMaterialUsage(orderId!),
    enabled: Boolean(orderId) && enabled,
    staleTime: 10_000,
  });
}

export function useReturnUnusedMaterialMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { inventoryItemId: string; quantity: number; idempotencyKey?: string }) =>
      returnProductionUnusedMaterial(orderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.production.detail(orderId) });
    },
  });
}

export function useBlockTaskMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { taskId: string; category: string; reason: string }) =>
      blockProductionTask(args.taskId, {
        category: args.category,
        reason: args.reason,
      }),
    onSuccess: () => invalidateProduction(qc, orderId),
  });
}

export function useProductionProblemsQuery(
  status: ProductionProblemStatus,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.production.problems(status),
    queryFn: () => fetchProductionProblems(status),
    enabled,
    staleTime: 15_000,
  });
}
