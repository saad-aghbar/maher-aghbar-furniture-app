import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  ensureOrderProductionPlan,
  getOrderProductionSetup,
  getOrderProductionSetupReleasePreview,
  markOrderProductionSetupReady,
  patchOrderSetupLine,
  putOrderSetupLineMaterials,
  releaseOrderProductionSetup,
  seedOrderSetupLineFromCatalog,
  type PatchOrderSetupLineInput,
  type PutOrderSetupMaterialsInput,
} from '../api';

export function useOrderProductionSetupQuery(salesOrderId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.salesOrders.productionSetup(salesOrderId),
    queryFn: () => getOrderProductionSetup(salesOrderId),
    enabled: Boolean(salesOrderId) && enabled,
    staleTime: 15_000,
  });
}

export function useOrderProductionSetupReleasePreviewQuery(
  salesOrderId: string,
  enabled = false,
) {
  return useQuery({
    queryKey: queryKeys.salesOrders.productionSetupReleasePreview(salesOrderId),
    queryFn: () => getOrderProductionSetupReleasePreview(salesOrderId),
    enabled: Boolean(salesOrderId) && enabled,
    staleTime: 10_000,
  });
}

function useInvalidateOrderSetup(salesOrderId: string) {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({
      queryKey: queryKeys.salesOrders.productionSetup(salesOrderId),
    });
    await qc.invalidateQueries({
      queryKey: queryKeys.salesOrders.productionSetupReleasePreview(salesOrderId),
    });
    await qc.invalidateQueries({
      queryKey: queryKeys.salesOrders.detail(salesOrderId),
    });
    await qc.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
  };
}

export function useOrderProductionSetupActions(salesOrderId: string) {
  const invalidate = useInvalidateOrderSetup(salesOrderId);
  return {
    patchLine: useMutation({
      mutationFn: ({
        lineId,
        body,
      }: {
        lineId: string;
        body: PatchOrderSetupLineInput;
      }) => patchOrderSetupLine(salesOrderId, lineId, body),
      onSuccess: invalidate,
    }),
    putMaterials: useMutation({
      mutationFn: ({
        lineId,
        body,
      }: {
        lineId: string;
        body: PutOrderSetupMaterialsInput;
      }) => putOrderSetupLineMaterials(salesOrderId, lineId, body),
      onSuccess: invalidate,
    }),
    seedFromCatalog: useMutation({
      mutationFn: (lineId: string) =>
        seedOrderSetupLineFromCatalog(salesOrderId, lineId),
      onSuccess: invalidate,
    }),
    markReady: useMutation({
      mutationFn: () => markOrderProductionSetupReady(salesOrderId),
      onSuccess: invalidate,
    }),
    ensurePlan: useMutation({
      mutationFn: () => ensureOrderProductionPlan(salesOrderId),
      onSuccess: invalidate,
    }),
    release: useMutation({
      mutationFn: () => releaseOrderProductionSetup(salesOrderId),
      onSuccess: invalidate,
    }),
  };
}
