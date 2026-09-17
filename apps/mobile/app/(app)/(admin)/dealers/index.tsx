import { useAuth } from '@/auth/AuthProvider';
import { DealersDeskHost } from '@/features/dealers/DealersDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminDealersRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="customer.read" mode="all">
      <DealersDeskHost />
    </PermissionGate>
  );
}
