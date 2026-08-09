import { Redirect, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';

/** Create flows moved to hub BottomSheets — keep route for deep links. */
export default function AdminCreatePurchaseRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="purchase-order.create" mode="all">
      <Redirect href={'/(app)/(admin)/purchasing' as Href} />
    </PermissionGate>
  );
}
