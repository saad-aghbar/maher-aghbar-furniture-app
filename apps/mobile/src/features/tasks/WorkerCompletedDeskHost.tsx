import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { isAtLeast } from '@/adaptive/breakpoints';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { firstSearchParam } from '@/adaptive/useDeskSelection';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { useAuth } from '@/auth/AuthProvider';
import { DeliveryOrdersListScreen } from '@/features/delivery-load';
import { isDeliveryFloorWorker } from '@/features/delivery-load/isDeliveryFloorWorker';
import { useLocale } from '@/i18n';
import { TasksListScreen } from './TasksListScreen';
import { WorkerCompletedSalesOrderItemsScreen } from './WorkerCompletedSalesOrderItemsScreen';
import { workerCompletedSalesOrderHref } from './selectTask';

/**
 * Worker completed tab. Sales-order list beside finished items on EXPANDED+;
 * compact still pushes the items picker.
 */
export function WorkerCompletedDeskHost() {
  const { t } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    selected?: string | string[];
    q?: string | string[];
    number?: string | string[];
  }>();
  const { windowClass } = useMaherLayout();
  const split = isAtLeast(windowClass, 'expanded');
  const selected = firstSearchParam(params.selected);
  const q = firstSearchParam(params.q);
  const number = firstSearchParam(params.number);

  if (isDeliveryFloorWorker(user)) {
    return <DeliveryOrdersListScreen variant="completed" />;
  }

  const onSelectOrder = (id: string, extras?: { q?: string; number?: string }) => {
    if (split) {
      router.setParams({
        selected: id,
        q: extras?.q ?? '',
        number: extras?.number ?? '',
      });
      return;
    }
    router.push(
      workerCompletedSalesOrderHref(
        { id, number: extras?.number ?? '' },
        { q: extras?.q },
      ) as Href,
    );
  };

  return (
    <SplitPane
      testID="worker-completed-desk-split"
      split={split}
      primary={
        <TasksListScreen
          variant="completed"
          selectedOrderId={selected}
          onSelectOrder={onSelectOrder}
        />
      }
      detail={
        selected ? (
          <WorkerCompletedSalesOrderItemsScreen
            salesOrderId={selected}
            embedded
            q={q}
            number={number}
          />
        ) : null
      }
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="checkmark-done-outline"
          title={t('mobile.adaptive.chooseOrderTitle')}
          body={t('mobile.adaptive.chooseOrderBody')}
        />
      }
    />
  );
}
