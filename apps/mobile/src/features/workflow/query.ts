import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  addWorkflowNode,
  archiveWorkflow,
  createDraftVersion,
  createStageDefinition,
  createWorkflow,
  discardWorkflowDraft,
  getProductionOrderWorkflow,
  getProductWorkflowConfiguration,
  getWorkflow,
  getWorkflowVersion,
  listAssignableWorkers,
  listStageLibrary,
  listWorkflows,
  publishWorkflowVersion,
  removeWorkflowNode,
  setStageWorkers,
  updateWorkflowNode,
  upsertProductWorkflowConfiguration,
  validateWorkflowVersion,
  assignProductionOrderWorkflow,
  getProductProductionSetup,
  getProductProductionSetupPreview,
  putProductProductionSetup,
} from '@/api/modules/workflow';

export function useWorkflowsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflow.lists(),
    queryFn: listWorkflows,
    enabled,
    staleTime: 30_000,
  });
}

export function useWorkflowQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflow.detail(id),
    queryFn: () => getWorkflow(id),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useWorkflowVersionQuery(
  workflowId: string,
  versionId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.workflow.version(workflowId, versionId ?? ''),
    queryFn: () => getWorkflowVersion(workflowId, versionId!),
    enabled: enabled && Boolean(workflowId && versionId),
    staleTime: 10_000,
  });
}

export function useStageLibraryQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflow.stageLibrary(),
    queryFn: listStageLibrary,
    enabled,
    staleTime: 60_000,
  });
}

export function useAssignableWorkersQuery(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.workflow.all, 'assignable-workers'] as const,
    queryFn: () => listAssignableWorkers(),
    enabled,
    staleTime: 60_000,
  });
}

export function useProductionOrderWorkflowQuery(productionOrderId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflow.orderGraph(productionOrderId),
    queryFn: () => getProductionOrderWorkflow(productionOrderId),
    enabled: enabled && Boolean(productionOrderId),
    staleTime: 15_000,
  });
}

export function useProductWorkflowQuery(productId: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.workflow.all, 'product', productId] as const,
    queryFn: () => getProductWorkflowConfiguration(productId),
    enabled: enabled && Boolean(productId),
    staleTime: 30_000,
  });
}

export function useCreateWorkflowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWorkflow,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.lists() });
    },
  });
}

export function useArchiveWorkflowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveWorkflow(id),
    onSuccess: async (_data, id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.workflow.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.workflow.detail(id) }),
      ]);
    },
  });
}

export function useCreateDraftMutation(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fromVersionId?: string) => createDraftVersion(workflowId, fromVersionId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.detail(workflowId) });
    },
  });
}

export function useCreateStageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStageDefinition,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.stageLibrary() });
    },
  });
}

export function useAddWorkflowNodeMutation(workflowId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addWorkflowNode.bind(null, workflowId, versionId),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: queryKeys.workflow.version(workflowId, versionId),
      });
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.detail(workflowId) });
    },
  });
}

export function useUpdateWorkflowNodeMutation(workflowId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { nodeId: string; body: Parameters<typeof updateWorkflowNode>[3] }) =>
      updateWorkflowNode(workflowId, versionId, args.nodeId, args.body),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: queryKeys.workflow.version(workflowId, versionId),
      });
    },
  });
}

export function useRemoveWorkflowNodeMutation(workflowId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { nodeId: string; expectedRevision: number }) =>
      removeWorkflowNode(workflowId, versionId, args.nodeId, args.expectedRevision),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: queryKeys.workflow.version(workflowId, versionId),
      });
    },
  });
}

export function useValidateWorkflowMutation(workflowId: string, versionId: string) {
  return useMutation({
    mutationFn: () => validateWorkflowVersion(workflowId, versionId),
  });
}

export function usePublishWorkflowMutation(workflowId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expectedRevision: number) =>
      publishWorkflowVersion(workflowId, versionId, expectedRevision),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.detail(workflowId) });
      await qc.invalidateQueries({
        queryKey: queryKeys.workflow.version(workflowId, versionId),
      });
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.lists() });
    },
  });
}

export function useDiscardWorkflowDraftMutation(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => discardWorkflowDraft(workflowId, versionId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.detail(workflowId) });
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.lists() });
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.all });
    },
  });
}

export function useSetStageWorkersMutation() {
  return useMutation({
    mutationFn: (args: { stageId: string; userIds: string[] }) =>
      setStageWorkers(args.stageId, args.userIds),
  });
}

export function useUpsertProductWorkflowMutation(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) =>
      upsertProductWorkflowConfiguration(productId, { workflowId }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: queryKeys.workflow.productConfig(productId),
      });
      await qc.invalidateQueries({
        queryKey: [...queryKeys.workflow.all, 'product', productId],
      });
    },
  });
}

export function useProductProductionSetupQuery(productId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflow.productionSetup(productId),
    queryFn: () => getProductProductionSetup(productId),
    enabled: enabled && Boolean(productId),
  });
}

export function useProductProductionSetupPreviewQuery(productId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflow.productionSetupPreview(productId),
    queryFn: () => getProductProductionSetupPreview(productId),
    enabled: enabled && Boolean(productId),
  });
}

export function usePutProductProductionSetupMutation(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof putProductProductionSetup>[1]) =>
      putProductProductionSetup(productId, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.productionSetup(productId) });
      await qc.invalidateQueries({
        queryKey: queryKeys.workflow.productionSetupPreview(productId),
      });
    },
  });
}

export function useAssignOrderWorkflowMutation(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) =>
      assignProductionOrderWorkflow(productionOrderId, workflowId),
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
