import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useAuth } from '@/auth/AuthProvider';
import { DeliveryOrdersListScreen } from '@/features/delivery-load';
import { isDeliveryFloorWorker } from '@/features/delivery-load/isDeliveryFloorWorker';
import { useLocale } from '@/i18n';
import { TaskDetailScreen } from './TaskDetailScreen';
import { TasksListScreen } from './TasksListScreen';

/**
 * Worker floor terminal. Task list beside the selected task on EXPANDED+;
 * information density stays low.
 */
export function WorkerTasksDeskHost() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { split, selected, selectOrPush } = useDeskSelection();

  if (isDeliveryFloorWorker(user)) {
    return <DeliveryOrdersListScreen variant="open" />;
  }

  return (
    <SplitPane
      testID="worker-tasks-desk-split"
      split={split}
      primary={
        <TasksListScreen
          variant="open"
          selectedTaskId={selected}
          onSelectTask={(id) =>
            selectOrPush(id, `/(app)/(employee)/tasks/${id}` as Href)
          }
        />
      }
      detail={selected ? <TaskDetailScreen taskId={selected} embedded /> : null}
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
