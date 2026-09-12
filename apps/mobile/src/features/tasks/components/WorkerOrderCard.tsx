import { type Href } from 'expo-router';
import { useLocale } from '@/i18n';
import type { WorkerOrderCardModel } from '../selectWorkerOrder';
import { IndustrialFloorTaskCard } from './IndustrialFloorTaskCard';

type Props = {
  order: WorkerOrderCardModel;
  index?: number;
  animateEnter?: boolean;
};

export function WorkerOrderCard({ order, index = 0, animateEnter = true }: Props) {
  const { t } = useLocale();

  return (
    <IndustrialFloorTaskCard
      index={index}
      animateEnter={animateEnter}
      href={`/(app)/(employee)/lane/${order.id}` as Href}
      metaStage={{
        label: t('mobile.tasks.cardRemaining'),
        value: t('mobile.tasks.orderCardTasks', { count: order.myTaskCount }),
      }}
      task={{
        id: order.id,
        department: t('mobile.tasks.openWork'),
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
