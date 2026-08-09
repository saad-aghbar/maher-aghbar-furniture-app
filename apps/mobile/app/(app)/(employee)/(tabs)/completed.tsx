import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { TasksListScreen } from '@/features/tasks/TasksListScreen';

export default function EmployeeCompletedTasks() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <TasksListScreen variant="completed" />
    </PermissionGate>
  );
}
