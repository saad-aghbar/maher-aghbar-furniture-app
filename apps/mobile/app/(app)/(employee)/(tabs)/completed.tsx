import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { DeliveryOrdersListScreen } from '@/features/delivery-load';
import { isDeliveryFloorWorker } from '@/features/delivery-load/isDeliveryFloorWorker';
import { TasksListScreen } from '@/features/tasks/TasksListScreen';

export default function EmployeeCompletedTasks() {
  const { user } = useAuth();
  if (isDeliveryFloorWorker(user)) {
    return (
      <PermissionGate user={user} require="delivery.read" mode="all">
        <DeliveryOrdersListScreen variant="completed" />
      </PermissionGate>
    );
  }
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <TasksListScreen variant="completed" />
    </PermissionGate>
  );
}
