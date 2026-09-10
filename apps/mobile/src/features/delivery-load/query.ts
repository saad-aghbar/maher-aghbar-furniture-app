import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  checkDeliveryLoadPiece,
  departDelivery,
  getDeliveryLoadSheet,
  listMyDeliveries,
  uncheckDeliveryLoadPiece,
  type DeliveryLoadSheet,
  type ListMyDeliveriesParams,
} from '@/api/modules/deliveries';

export const deliveryLoadKeys = {
  all: ['deliveries', 'mine'] as const,
  list: (params: ListMyDeliveriesParams) => [...deliveryLoadKeys.all, 'list', params] as const,
  sheet: (id: string) => [...deliveryLoadKeys.all, 'sheet', id] as const,
};

function togglePieceLoaded(sheet: DeliveryLoadSheet, pieceId: string, loaded: boolean): DeliveryLoadSheet {
  const now = loaded ? new Date().toISOString() : null;
  const products = sheet.products.map((product) => ({
    ...product,
    pieces: product.pieces.map((piece) =>
      piece.id === pieceId ? { ...piece, loadedAt: now } : piece,
    ),
  }));
  const loadedCount = products.reduce(
    (sum, product) => sum + product.pieces.filter((p) => p.loadedAt).length,
    0,
  );
  const total = products.reduce((sum, product) => sum + product.pieces.length, 0);
  return {
    ...sheet,
    products,
    loadProgress: { loaded: loadedCount, total },
    allLoaded: total > 0 && loadedCount === total,
  };
}

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
  const key = deliveryLoadKeys.sheet(deliveryId);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: deliveryLoadKeys.all });
  };

  const check = useMutation({
    mutationFn: (pieceId: string) => checkDeliveryLoadPiece(deliveryId, pieceId),
    onMutate: async (pieceId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DeliveryLoadSheet>(key);
      if (prev) qc.setQueryData(key, togglePieceLoaded(prev, pieceId, true));
      return { prev };
    },
    onError: (_err, _pieceId, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      invalidate();
    },
  });

  const uncheck = useMutation({
    mutationFn: (pieceId: string) => uncheckDeliveryLoadPiece(deliveryId, pieceId),
    onMutate: async (pieceId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DeliveryLoadSheet>(key);
      if (prev) qc.setQueryData(key, togglePieceLoaded(prev, pieceId, false));
      return { prev };
    },
    onError: (_err, _pieceId, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      invalidate();
    },
  });

  const depart = useMutation({
    mutationFn: () => departDelivery(deliveryId),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      invalidate();
    },
  });

  return { check, uncheck, depart };
}

