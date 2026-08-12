import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  getProductProductionProfile,
  listProductStageEstimates,
  patchProductProductionProfile,
  patchProductStageEstimates,
  recalculateSchedule,
  stageEstimateMinutes,
  type ProductStageEstimateInput,
} from '@/api/modules/scheduling';
import { customizeProductionOrderWorkflow } from '@/api/modules/workflow';

export function useProductProductionProfileQuery(productId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.scheduling.productProfile(productId),
    queryFn: () => getProductProductionProfile(productId),
    enabled: enabled && Boolean(productId),
    staleTime: 30_000,
  });
}

export function useProductStageEstimatesQuery(productId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.scheduling.productStageEstimates(productId),
    queryFn: () => listProductStageEstimates(productId),
    enabled: enabled && Boolean(productId),
    staleTime: 30_000,
  });
}

export function useUpsertProductStageEstimatesMutation(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ProductStageEstimateInput[]) => {
      const rows = await patchProductStageEstimates(productId, items);
      const total = rows.reduce((sum, row) => sum + stageEstimateMinutes(row), 0);
      await patchProductProductionProfile(productId, {
        totalStandardMinutes: total,
        isSchedulingEnabled: true,
      });
      return rows;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: queryKeys.scheduling.productStageEstimates(productId),
      });
      await qc.invalidateQueries({
        queryKey: queryKeys.scheduling.productProfile(productId),
      });
    },
  });
}

export function useCustomizeOrderWorkflowMinutesMutation(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      snapshotNodeId: string;
      estimatedMinutes: number;
      regenerate?: boolean;
    }) => {
      const graph = await customizeProductionOrderWorkflow(productionOrderId, {
        nodes: [
          {
            snapshotNodeId: args.snapshotNodeId,
            estimatedMinutes: args.estimatedMinutes,
          },
        ],
      });
      if (args.regenerate !== false) {
        await recalculateSchedule(productionOrderId, {
          reason: 'order-stage-estimate-updated',
        }).catch(() => undefined);
      }
      return graph;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: queryKeys.workflow.orderGraph(productionOrderId),
      });
      await qc.invalidateQueries({
        queryKey: queryKeys.scheduling.orderSchedule(productionOrderId),
      });
      await qc.invalidateQueries({ queryKey: queryKeys.production.all });
      await qc.invalidateQueries({ queryKey: queryKeys.scheduling.atRisk() });
    },
  });
}
