import { useAuth } from '@/auth/AuthProvider';
import { ReceiveQueueScreen } from '@/features/purchasing/ReceiveQueueScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminReceiveQueueRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.receive" mode="all">
      <ReceiveQueueScreen />
    </PermissionGate>
  );
}
