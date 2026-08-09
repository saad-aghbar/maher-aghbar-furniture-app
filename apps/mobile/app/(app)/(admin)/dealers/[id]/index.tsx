import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerDetailScreen } from '@/features/dealers/DealerDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminDealerDetailRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dealerId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

  return (
    <PermissionGate user={user} require="customer.read" mode="all">
      <DealerDetailScreen dealerId={dealerId} />
    </PermissionGate>
  );
}
