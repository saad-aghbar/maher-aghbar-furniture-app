import { useAuth } from '@/auth/AuthProvider';
import { PurchasingHubScreen } from '@/features/purchasing/PurchasingHubScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminPurchasingRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['purchase-order.read', 'supplier.read']}
      mode="any"
    >
      <PurchasingHubScreen />
    </PermissionGate>
  );
}
