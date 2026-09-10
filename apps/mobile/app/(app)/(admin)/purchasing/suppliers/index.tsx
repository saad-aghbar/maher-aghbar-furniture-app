import { useAuth } from '@/auth/AuthProvider';
import { SuppliersListScreen } from '@/features/purchasing/SuppliersListScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminPurchasingSuppliersRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="supplier.read" mode="all">
      <SuppliersListScreen />
    </PermissionGate>
  );
}
