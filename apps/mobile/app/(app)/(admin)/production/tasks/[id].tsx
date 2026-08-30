import { useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { TaskDetailScreen } from '@/features/tasks/TaskDetailScreen';

/**
 * Admin entry into the worker floor for a stage task (from production order hub).
 */
export default function AdminProductionTaskFloorRoute() {
  const { id, orderId } = useLocalSearchParams<{ id: string; orderId?: string }>();
  const { user } = useAuth();
  const backFallback = (
    orderId
      ? `/(app)/(admin)/production/${orderId}`
      : '/(app)/(admin)/(tabs)/production'
  ) as Href;

  return (
    <PermissionGate user={user} require="production-task.read" mode="all">
      <TaskDetailScreen taskId={String(id ?? '')} backFallback={backFallback} />
    </PermissionGate>
  );
}
