import { useAuth } from '@/auth/AuthProvider';
import { LowStockReviewScreen } from '@/features/purchasing/LowStockReviewScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminLowStockRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="purchase-order.create" mode="all">
      <LowStockReviewScreen />
    </PermissionGate>
  );
}
