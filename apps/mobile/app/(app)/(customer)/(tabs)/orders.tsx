import { OrdersDeskHost } from '@/features/sales-orders/OrdersDeskHost';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerOrders() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read">
      <OrdersDeskHost variant="dealer" />
    </PermissionGate>
  );
}
