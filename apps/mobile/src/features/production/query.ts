import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCustomers } from '@/api/modules/customers';
import { queryKeys } from '@/api/queryKeys';
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
  suggestPlanSchedule,
  type ProductionListBucket,
  type ProductionPriority,
  type ProductionDateMode,
} from './api';
import {
  patchOrderSetupLine,
  previewOrderSetupLineSeedFromCatalog,
  seedOrderSetupLineFromCatalog,
} from '@/api/modules/sales-orders';
import { invalidateAfterCatalogSeed } from '@/features/sales-orders/catalogTemplateSheet';

export function useProductionSummaryQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.production.summary(),
    queryFn: getProductionSummary,
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
  },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...queryKeys.production.all, 'day-summary', filters] as const,
    queryFn: () => getProductionDaySummary(filters),
    enabled: enabled && Boolean(filters.onDate),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
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
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    // Keep the current list on screen while the next bucket/search loads
    placeholderData: keepPreviousData,
  });
}

export function flattenProductionOrderPages(
  data: ReturnType<typeof useProductionOrdersInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

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
  await Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.production.lists() }),
    qc.invalidateQueries({ queryKey: queryKeys.production.summary() }),
    qc.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
    orderId
      ? qc.invalidateQueries({ queryKey: queryKeys.production.detail(orderId) })
      : Promise.resolve(),
    orderId
      ? qc.invalidateQueries({
          queryKey: queryKeys.production.planSetup(orderId),
        })
      : Promise.resolve(),
  ]);
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
      overrideConflict?: boolean;
    }) =>
      assignTask(args.taskId, {
        employeeId: args.employeeId,
        priority: args.priority,
        plannedStart: args.plannedStart,
        plannedCompletion: args.plannedCompletion,
        estimatedMinutes: args.estimatedMinutes,
        overrideConflict: args.overrideConflict,
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
