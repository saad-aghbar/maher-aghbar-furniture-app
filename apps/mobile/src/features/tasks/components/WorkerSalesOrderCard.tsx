import { useRouter, type Href } from 'expo-router';
import { useLocale } from '@/i18n';
import type { MyOrderSegment } from '../api';
import type { WorkerSalesOrderCardModel } from '../selectWorkerOrder';
import { IndustrialFloorTaskCard } from './IndustrialFloorTaskCard';

type Props = {
  order: WorkerSalesOrderCardModel;
  segment?: MyOrderSegment;
  q?: string;
  index?: number;
  animateEnter?: boolean;
};

export function WorkerSalesOrderCard({
  order,
  segment,
  q,
  index = 0,
  animateEnter = true,
}: Props) {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <IndustrialFloorTaskCard
      index={index}
      animateEnter={animateEnter}
      onPress={() => {
        if (order.itemCount <= 1) {
          router.push(`/(app)/(employee)/lane/${order.laneId}` as Href);
          return;
        }
        router.push({
          pathname: '/(app)/(employee)/orders/[salesOrderId]',
          params: {
            salesOrderId: order.id,
            ...(segment ? { segment } : {}),
            ...(q?.trim() ? { q: q.trim() } : {}),
          },
        });
      }}
      metaStage={{
        label: t('mobile.tasks.cardRemaining'),
        value: t('mobile.tasks.orderCardTasks', { count: order.myTaskCount }),
      }}
      task={{
        id: order.id,
        department:
          order.itemCount > 1
            ? t('mobile.tasks.orderItemsCount', { count: order.itemCount })
            : t('mobile.tasks.openWork'),
        productTitle: order.productTitle,
        orderNumber: order.number,
        factoryOrderNumber: order.factoryOrderNumber,
        imageUrl: order.imageUrl,
        priority: order.priority,
        deadline: order.deadline,
        blocked: order.blockedCount > 0,
      }}
    />
  );
}
