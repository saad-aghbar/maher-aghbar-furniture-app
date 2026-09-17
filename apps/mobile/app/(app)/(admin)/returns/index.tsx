import { useAuth } from '@/auth/AuthProvider';
import { ReturnsDeskHost } from '@/features/returns/ReturnsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminReturnsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="return.read" mode="all">
      <ReturnsDeskHost />
    </PermissionGate>
  );
}
