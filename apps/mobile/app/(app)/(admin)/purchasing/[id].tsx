import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PurchaseDetailScreen } from '@/features/purchasing/PurchaseDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminPurchaseDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="purchase-order.read" mode="all">
      <PurchaseDetailScreen orderId={String(id ?? '')} />
    </PermissionGate>
  );
}
