import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { isDeliveryFloorWorker } from '@/features/delivery-load/isDeliveryFloorWorker';
import { DeliveryOrdersListScreen } from '@/features/delivery-load';
import { WorkerTasksDeskHost } from '@/features/tasks/WorkerTasksDeskHost';

export default function EmployeeTasks() {
  const { user } = useAuth();
  if (isDeliveryFloorWorker(user)) {
    return (
      <PermissionGate user={user} require="delivery.read" mode="all">
        <DeliveryOrdersListScreen variant="open" />
      </PermissionGate>
    );
  }
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <WorkerTasksDeskHost />
    </PermissionGate>
  );
}
