import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mapConfirmReceiptErrorCode } from '@maher/types';
import { confirmDeliveryReceipt } from '@/api/modules/deliveries';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { getSalesOrder } from '@/api/modules/sales-orders';
import { useToast } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';

export type ReceiptConfirmTarget = {
  salesOrderId: string;
  salesOrderNumber: string;
  productTitle: string;
  quantity?: string | number | null;
  imageUrl?: string | null;
};

export function useDealerReceiptConfirm() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [target, setTarget] = useState<ReceiptConfirmTarget | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const mutation = useMutation({
    mutationFn: (id: string) => confirmDeliveryReceipt(id),
    onSuccess: async () => {
      setTarget(null);
      setDeliveryId(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.details() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.ownDeliveries() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.dealerHome() });
      showToast({
        variant: 'success',
        message: t('lifecycle.confirmReceiptSuccess'),
      });
    },
    onError: (err) => {
      const code = isApiError(err) ? err.code : null;
      setError(t(`lifecycle.${mapConfirmReceiptErrorCode(code)}`));
    },
  });

  async function open(next: ReceiptConfirmTarget) {
    setTarget(next);
    setDeliveryId(null);
    setError(null);
    setResolving(true);
    try {
      const detail = await getSalesOrder(next.salesOrderId);
      const delivery = (detail.deliveries ?? []).find(
        (d) => String(d.status).toUpperCase() === 'OUT_FOR_DELIVERY',
      );
      if (!delivery) {
        setError(t('lifecycle.confirmWrongState'));
        return;
      }
      setDeliveryId(delivery.id);
    } catch (err) {
      const code = isApiError(err) ? err.code : null;
      setError(t(`lifecycle.${mapConfirmReceiptErrorCode(code)}`));
    } finally {
      setResolving(false);
    }
  }

  function close() {
    if (resolving || mutation.isPending) return;
    setTarget(null);
    setDeliveryId(null);
    setError(null);
  }

  return {
    target,
    deliveryId,
    error,
    resolving,
    pending: mutation.isPending,
    open,
    close,
    confirm: () => {
      setError(null);
      if (deliveryId) mutation.mutate(deliveryId);
    },
  };
}
