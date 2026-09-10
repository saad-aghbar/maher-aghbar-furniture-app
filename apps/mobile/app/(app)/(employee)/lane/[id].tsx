import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { WorkerOrderWorkflowScreen } from '@/features/tasks/WorkerOrderWorkflowScreen';

export default function EmployeeOrderLaneRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <WorkerOrderWorkflowScreen productionOrderId={String(id ?? '')} />
    </PermissionGate>
  );
}
