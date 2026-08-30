import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { OrderProductionSetupScreen } from '@/features/sales-orders/OrderProductionSetupScreen';

export default function AdminOrderProductionSetupRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <OrderProductionSetupScreen orderId={String(id ?? '')} />
    </PermissionGate>
  );
}
