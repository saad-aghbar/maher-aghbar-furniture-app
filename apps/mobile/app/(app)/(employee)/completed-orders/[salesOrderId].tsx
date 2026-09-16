import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { WorkerCompletedSalesOrderItemsScreen } from '@/features/tasks/WorkerCompletedSalesOrderItemsScreen';

export default function EmployeeCompletedSalesOrderItemsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <WorkerCompletedSalesOrderItemsScreen />
    </PermissionGate>
  );
}
