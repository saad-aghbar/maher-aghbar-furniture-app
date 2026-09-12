import { useAuth } from '@/auth/AuthProvider';
import { OrderBasketScreen } from '@/features/requests/OrderBasketScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerBasketTab() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="request.create" mode="all">
      <OrderBasketScreen />
    </PermissionGate>
  );
}
