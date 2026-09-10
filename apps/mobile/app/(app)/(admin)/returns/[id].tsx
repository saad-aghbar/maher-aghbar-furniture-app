import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ReturnDetailScreen } from '@/features/returns/ReturnDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminReturnDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require={['return.read', 'sales-order.read']} mode="any">
      <ReturnDetailScreen returnId={String(id ?? '')} />
    </PermissionGate>
  );
}
