import { type Href } from 'expo-router';
import { useLocale } from '@/i18n';
import { workerItemWorkState, type WorkerOrderCardModel } from '../selectWorkerOrder';
import { IndustrialFloorTaskCard } from './IndustrialFloorTaskCard';

type Props = {
  order: WorkerOrderCardModel;
  index?: number;
  animateEnter?: boolean;
};

export function WorkerOrderCard({ order, index = 0, animateEnter = true }: Props) {
  const { t } = useLocale();
  const workState = workerItemWorkState(order);

  const metaStage =
    workState === 'done'
      ? {
          label: t('mobile.tasks.segments.done'),
          value: t('mobile.tasks.segments.done'),
        }
      : workState === 'locked'
        ? {
            label: t('mobile.tasks.lockLocked'),
            value: t('mobile.tasks.lockLocked'),
          }
        : {
            label: order.assignedToMe
              ? t('mobile.tasks.cardRemaining')
              : t('mobile.tasks.viewOnly'),
            value: order.assignedToMe
              ? t('mobile.tasks.orderCardTasks', { count: order.myTaskCount })
              : t('mobile.tasks.viewOnly'),
          };

  return (
    <IndustrialFloorTaskCard
      index={index}
      animateEnter={animateEnter}
      href={`/(app)/(employee)/lane/${order.id}` as Href}
      metaStage={metaStage}
      task={{
        id: order.id,
        department: t('mobile.tasks.openWork'),
        productTitle: order.productTitle,
        orderNumber: order.number,
        factoryOrderNumber: order.factoryOrderNumber,
        imageUrl: order.imageUrl,
        priority: order.priority,
        deadline: order.deadline,
        blocked: workState === 'locked' || order.blockedCount > 0,
        workState,
      }}
    />
  );
}
