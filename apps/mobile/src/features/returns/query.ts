import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import {
  cancelReturn,
  cancelReturnPiece,
  chargeReturn,
  createReturn,
  decideReturnPieces,
  getReturn,
  listReturns,
  markReturnReady,
  markReturnSent,
  needInfoReturn,
  postReturnRecoveryLine,
  receiveReturn,
  recordReturnRecoveryLine,
  updateReturnRecoveryLine,
  deleteReturnRecoveryLine,
  resolveReturn,
  scheduleReturnReship,
  respondReturnCharge,
  sendReturnCharge,
  setReturnResponsibility,
  type ReturnPieceDecision,
  type ReturnReason,
  type ReturnResolution,
  type ReturnResponsibility,
} from './api';

export function useReturnsInfiniteQuery(
  filters: { q?: string; customerId?: string },
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.returns.list(filters),
    queryFn: ({ pageParam }) =>
      listReturns({ page: pageParam, pageSize: 20, ...filters }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
  });
}

export function flattenReturns(data: ReturnType<typeof useReturnsInfiniteQuery>['data']) {
  return flattenPaginatedPages(data?.pages);
}

export function useReturnQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.returns.detail(id ?? ''),
    queryFn: () => getReturn(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateReturnMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createReturn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.returns.lists() }),
  });
}

function invalidateReturn(qc: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.returns.detail(id) }),
    qc.invalidateQueries({ queryKey: queryKeys.returns.lists() }),
    qc.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
    qc.invalidateQueries({ queryKey: queryKeys.production.all }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  ]);
}

export function useResolveReturnMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      status: 'APPROVED' | 'REJECTED' | 'NEED_INFO';
      resolution?: Exclude<ReturnResolution, 'REJECTED'>;
      notes?: string;
      needInfoNote?: string;
    }) => resolveReturn(id, input.status, {
      resolution: input.resolution,
      notes: input.notes,
      needInfoNote: input.needInfoNote,
    }),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useNeedInfoReturnMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (needInfoNote: string) => needInfoReturn(id, needInfoNote),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useReceiveReturnMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: {
      pieceIds?: string[];
      receivedQuantity?: number;
      receivedCondition?: string;
      receivedNotes?: string;
      warehouseId?: string;
      receivedLocationId?: string;
      photoKeys?: string[];
    }) => receiveReturn(id, body),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useMarkReturnSentMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markReturnSent(id),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useDecidePiecesMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ pieceId: string; decision: ReturnPieceDecision; inspectionNotes?: string }>) =>
      decideReturnPieces(id, items),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useRecordRecoveryLineMutation(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      pieceId: string;
      productionTaskId?: string;
      inventoryItemId?: string;
      label: string;
      quantity: number;
      unit?: string;
      outcome: 'RECOVER_TO_INVENTORY' | 'DISPOSE' | 'DAMAGED';
      destinationWarehouseId?: string;
      destinationLocationId?: string;
      notes?: string;
    }) => recordReturnRecoveryLine(returnId, input.pieceId, input),
    onSuccess: async () => {
      await invalidateReturn(qc, returnId);
    },
  });
}

export function useUpdateRecoveryLineMutation(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      lineId: string;
      inventoryItemId?: string | null;
      label?: string;
      quantity?: number;
      unit?: string;
      outcome?: 'RECOVER_TO_INVENTORY' | 'DISPOSE' | 'DAMAGED';
      destinationWarehouseId?: string;
      destinationLocationId?: string | null;
      notes?: string;
    }) => updateReturnRecoveryLine(returnId, input.lineId, input),
    onSuccess: async () => {
      await invalidateReturn(qc, returnId);
    },
  });
}

export function useDeleteRecoveryLineMutation(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => deleteReturnRecoveryLine(returnId, lineId),
    onSuccess: async () => {
      await invalidateReturn(qc, returnId);
    },
  });
}

export function usePostRecoveryLineMutation(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => postReturnRecoveryLine(returnId, lineId),
    onSuccess: async () => {
      await invalidateReturn(qc, returnId);
    },
  });
}

export function useScheduleReshipMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { address?: string; notes?: string }) => scheduleReturnReship(id, body),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useChargeReturnMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { amount?: number; description?: string }) => chargeReturn(id, body),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useMarkReturnReadyMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markReturnReady(id),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useCancelReturnMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelReturn(id),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useCancelReturnPieceMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pieceId: string) => cancelReturnPiece(id, pieceId),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useSetResponsibilityMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      responsibility: ReturnResponsibility;
      dealerAmount?: number;
      factoryAmount?: number;
      chargeAmount?: number;
    }) => setReturnResponsibility(id, body),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useSendReturnChargeMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sendReturnCharge(id),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export function useRespondReturnChargeMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { accept: boolean; note?: string }) => respondReturnCharge(id, body),
    onSuccess: async () => {
      await invalidateReturn(qc, id);
    },
  });
}

export type { ReturnReason, ReturnResolution, ReturnResponsibility, ReturnPieceDecision };
