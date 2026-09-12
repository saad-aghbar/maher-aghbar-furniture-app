import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { WorkerSalesOrderItemsScreen } from '@/features/tasks/WorkerSalesOrderItemsScreen';

export default function EmployeeSalesOrderItemsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <WorkerSalesOrderItemsScreen />
    </PermissionGate>
  );
}
