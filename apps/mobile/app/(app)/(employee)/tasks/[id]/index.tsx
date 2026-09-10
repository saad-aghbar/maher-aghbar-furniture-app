import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { TaskDetailScreen } from '@/features/tasks/TaskDetailScreen';

export default function EmployeeTaskDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <TaskDetailScreen taskId={String(id ?? '')} />
    </PermissionGate>
  );
}
