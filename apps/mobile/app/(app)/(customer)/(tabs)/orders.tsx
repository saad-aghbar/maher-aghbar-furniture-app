import { OrdersListScreen } from '@/features/sales-orders/OrdersListScreen';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerOrders() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read">
      <OrdersListScreen variant="dealer" />
    </PermissionGate>
  );
}
