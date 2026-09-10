import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PurchaseRunDetailScreen } from '@/features/purchasing/PurchaseRunDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminPurchaseRunRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="purchase-order.read" mode="all">
      <PurchaseRunDetailScreen runId={String(id ?? '')} />
    </PermissionGate>
  );
}
