import { useAuth } from '@/auth/AuthProvider';
import { DealersListScreen } from '@/features/dealers/DealersListScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminDealersRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="customer.read" mode="all">
      <DealersListScreen />
    </PermissionGate>
  );
}
