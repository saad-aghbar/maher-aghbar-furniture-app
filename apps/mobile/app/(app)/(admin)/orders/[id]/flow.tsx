import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { OrderProductionFlowScreen } from '@/features/production-flow/OrderProductionFlowScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

export default function AdminOrderFlowRoute() {
  const { user } = useAuth();
  const { id, po } = useLocalSearchParams<{ id: string; po?: string }>();
  const salesOrderId = firstParam(id);
  const selected = firstParam(po);
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <OrderProductionFlowScreen
        role="admin"
        salesOrderId={salesOrderId}
        selectedProductionOrderId={selected || null}
        orderBackFallback={`/(app)/(admin)/orders/${salesOrderId}` as never}
      />
    </PermissionGate>
  );
}
