import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { OrderProductionPlanEditorScreen } from '@/features/sales-orders/OrderProductionPlanEditorScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProductionPlanRoute() {
  const { id, task } = useLocalSearchParams<{ id: string; task?: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-order.read" mode="all">
      <OrderProductionPlanEditorScreen
        productionOrderId={String(id ?? '')}
        initialAssignTaskId={task ? String(task) : null}
      />
    </PermissionGate>
  );
}
