import { useAuth } from '@/auth/AuthProvider';
import { PurchaseOrderBuilderScreen } from '@/features/purchasing/PurchaseOrderBuilderScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminNewPurchaseOrderRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="purchase-order.create" mode="all">
      <PurchaseOrderBuilderScreen />
    </PermissionGate>
  );
}
