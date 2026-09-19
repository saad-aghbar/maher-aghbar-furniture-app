import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordCatalogFabric } from '@/api/modules/catalog';
import { invalidateFactoryJourney } from '@/api/invalidateFactoryJourney';
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
    await invalidateFactoryJourney(qc);
    await qc.invalidateQueries({
      queryKey: queryKeys.salesOrders.productionSetup(salesOrderId),
    });
    await qc.invalidateQueries({
      queryKey: queryKeys.salesOrders.productionSetupReleasePreview(salesOrderId),
    });
  };
}

export function useOrderProductionSetupActions(salesOrderId: string) {
  const qc = useQueryClient();
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
      mutationFn: ({
        lineId,
        confirmWorkflowChange,
      }: {
        lineId: string;
        confirmWorkflowChange?: boolean;
      }) =>
        seedOrderSetupLineFromCatalog(salesOrderId, lineId, { confirmWorkflowChange }),
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
    recordCatalogFabric: useMutation({
      mutationFn: (input: { nameEn: string; nameAr?: string; color?: string }) =>
        recordCatalogFabric(input),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: queryKeys.catalog.fabrics() });
      },
    }),
  };
}
