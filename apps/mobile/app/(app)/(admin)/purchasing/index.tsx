import { useAuth } from '@/auth/AuthProvider';
import { PurchasingDeskHost } from '@/features/purchasing/PurchasingDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminPurchasingRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['purchase-order.read', 'supplier.read', 'fabric.procurement.read']}
      mode="any"
    >
      <PurchasingDeskHost />
    </PermissionGate>
  );
}
