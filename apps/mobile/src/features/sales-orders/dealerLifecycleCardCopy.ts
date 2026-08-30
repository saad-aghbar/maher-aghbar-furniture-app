import { classifyDealerLifecycle } from '@maher/types';

type CopyInput = {
  status: string;
  deliveryStatus?: string | null;
  deliveryDate?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
};

type CopyResult = {
  lifecycleStatus: string;
  summary: string | null;
  confirmCta?: boolean;
};

export function dealerLifecycleCardCopy(
  input: CopyInput,
  t: (key: string, values?: Record<string, string | number>) => string,
  formatDate: (value: string) => string,
): CopyResult {
  const tab = classifyDealerLifecycle({
    salesOrderStatus: input.status,
    deliveryStatus: input.deliveryStatus,
    productionStarted: input.status === 'IN_PRODUCTION' || input.status === 'READY_FOR_DELIVERY',
  });

  switch (tab) {
    case 'shipped': {
      const date = input.shippedAt ?? input.deliveryDate;
      return {
        lifecycleStatus: t('lifecycle.shipped'),
        summary: date
          ? `${t('lifecycle.shippedHero')} ${t('lifecycle.shippedOn', { date: formatDate(date) })} · ${t('lifecycle.confirmWhenReceived')}`
          : `${t('lifecycle.shippedHero')} ${t('lifecycle.confirmWhenReceived')}`,
        confirmCta: true,
      };
    }
    case 'ready':
      return {
        lifecycleStatus: t('lifecycle.readyForDelivery'),
        summary: input.deliveryDate
          ? formatDate(input.deliveryDate)
          : null,
        confirmCta: false,
      };
    case 'delivered': {
      const date = input.deliveredAt ?? input.deliveryDate;
      return {
        lifecycleStatus: t('lifecycle.tabs.delivered'),
        summary: date
          ? t('lifecycle.receivedOn', { date: formatDate(date) })
          : t('lifecycle.receiptConfirmed'),
        confirmCta: false,
      };
    }
    case 'inProduction':
      return {
        lifecycleStatus: t('lifecycle.tabs.inProduction'),
        summary: input.deliveryDate ? formatDate(input.deliveryDate) : null,
        confirmCta: false,
      };
    default:
      return { lifecycleStatus: '', summary: null, confirmCta: false };
  }
}
