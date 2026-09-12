import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { OrderProductionPlanScreen } from '@/features/sales-orders/OrderProductionPlanScreen';

export default function OrderProductionPlanRoute() {
  const { user } = useAuth();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId?: string }>();
  const line =
    typeof lineId === 'string' ? lineId : Array.isArray(lineId) ? lineId[0] : undefined;

  return (
    <PermissionGate user={user} require="production-order.read" mode="all">
      <OrderProductionPlanScreen
        salesOrderId={String(id ?? '')}
        lineId={line}
      />
    </PermissionGate>
  );
}
