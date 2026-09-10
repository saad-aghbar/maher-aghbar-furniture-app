import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { TaskKitTakeInScreen } from '@/features/tasks/TaskKitTakeInScreen';

export default function EmployeeTaskTakeInRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <TaskKitTakeInScreen taskId={String(id ?? '')} />
    </PermissionGate>
  );
}
