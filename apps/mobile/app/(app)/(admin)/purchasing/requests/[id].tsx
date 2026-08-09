import { useLocalSearchParams, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PurchaseRequestDetailScreen } from '@/features/purchasing/PurchaseRequestDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminPurchaseRequestDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="purchase-request.read" mode="all">
      <PurchaseRequestDetailScreen requestId={String(id ?? '')} />
    </PermissionGate>
  );
}
