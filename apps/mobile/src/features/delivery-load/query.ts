import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  checkDeliveryLoadPiece,
  departDelivery,
  getDeliveryLoadSheet,
  listMyDeliveries,
  uncheckDeliveryLoadPiece,
  type ListMyDeliveriesParams,
} from '@/api/modules/deliveries';

export const deliveryLoadKeys = {
  all: ['deliveries', 'mine'] as const,
  list: (params: ListMyDeliveriesParams) => [...deliveryLoadKeys.all, 'list', params] as const,
  sheet: (id: string) => [...deliveryLoadKeys.all, 'sheet', id] as const,
};

export function useMyDeliveriesQuery(params: ListMyDeliveriesParams, enabled = true) {
  return useQuery({
    queryKey: deliveryLoadKeys.list(params),
    queryFn: () => listMyDeliveries(params),
    enabled,
  });
}

export function useDeliveryLoadSheetQuery(deliveryId: string | null, enabled = true) {
  return useQuery({
    queryKey: deliveryLoadKeys.sheet(deliveryId ?? ''),
    queryFn: () => getDeliveryLoadSheet(deliveryId!),
    enabled: Boolean(deliveryId) && enabled,
  });
}

export function useDeliveryLoadMutations(deliveryId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: deliveryLoadKeys.all });
  };

  const check = useMutation({
    mutationFn: (pieceId: string) => checkDeliveryLoadPiece(deliveryId, pieceId),
    onSuccess: (data) => {
      qc.setQueryData(deliveryLoadKeys.sheet(deliveryId), data);
      invalidate();
    },
  });

  const uncheck = useMutation({
    mutationFn: (pieceId: string) => uncheckDeliveryLoadPiece(deliveryId, pieceId),
    onSuccess: (data) => {
      qc.setQueryData(deliveryLoadKeys.sheet(deliveryId), data);
      invalidate();
    },
  });

  const depart = useMutation({
    mutationFn: () => departDelivery(deliveryId),
    onSuccess: (data) => {
      qc.setQueryData(deliveryLoadKeys.sheet(deliveryId), data);
      invalidate();
    },
  });

  return { check, uncheck, depart };
}
