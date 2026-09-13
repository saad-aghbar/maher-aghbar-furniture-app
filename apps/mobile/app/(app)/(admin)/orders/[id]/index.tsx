import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { OrderDetailScreen } from '@/features/sales-orders/OrderDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminOrderDetailRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <OrderDetailScreen orderId={String(id ?? '')} variant="admin" />
    </PermissionGate>
  );
}
