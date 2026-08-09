import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ReturnDetailScreen } from '@/features/returns/ReturnDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerReturnDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <ReturnDetailScreen returnId={String(id ?? '')} />
    </PermissionGate>
  );
}
