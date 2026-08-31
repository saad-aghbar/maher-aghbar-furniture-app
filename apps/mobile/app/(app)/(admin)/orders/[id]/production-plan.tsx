import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { OrderProductionPlanScreen } from '@/features/sales-orders/OrderProductionPlanScreen';

export default function OrderProductionPlanRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PermissionGate user={user} require="production-order.read" mode="all">
      <OrderProductionPlanScreen salesOrderId={String(id ?? '')} />
    </PermissionGate>
  );
}
