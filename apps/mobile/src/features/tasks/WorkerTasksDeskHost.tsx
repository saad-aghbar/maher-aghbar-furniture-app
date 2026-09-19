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
import { WorkerSalesOrderItemsScreen } from './WorkerSalesOrderItemsScreen';
import { workerSalesOrderHref } from './selectWorkerOrder';

/**
 * Worker floor terminal. Sales-order list beside its factory items on EXPANDED+;
 * compact still pushes the items picker. Information density stays low.
 */
export function WorkerTasksDeskHost() {
  const { t } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    selected?: string | string[];
    segment?: string | string[];
    q?: string | string[];
  }>();
  const { windowClass } = useMaherLayout();
  const split = isAtLeast(windowClass, 'expanded');
  const selected = firstSearchParam(params.selected);
  const segment = firstSearchParam(params.segment);
  const q = firstSearchParam(params.q);

  if (isDeliveryFloorWorker(user)) {
    return <DeliveryOrdersListScreen variant="open" />;
  }

  const onSelectOrder = (id: string, extras?: { segment?: string; q?: string }) => {
    if (split) {
      router.setParams({
        selected: id,
        segment: extras?.segment ?? '',
        q: extras?.q ?? '',
      });
      return;
    }
    router.push(workerSalesOrderHref({ id }, extras) as Href);
  };

  return (
    <SplitPane
      testID="worker-tasks-desk-split"
      split={split}
      primary={
        <TasksListScreen
          variant="open"
          selectedOrderId={selected}
          onSelectOrder={onSelectOrder}
        />
      }
      detail={
        selected ? (
          <WorkerSalesOrderItemsScreen
            salesOrderId={selected}
            embedded
            segment={segment}
            q={q}
          />
        ) : null
      }
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="checkmark-done-outline"
          title={t('mobile.adaptive.chooseTaskTitle')}
          body={t('mobile.adaptive.chooseTaskBody')}
        />
      }
    />
  );
}
