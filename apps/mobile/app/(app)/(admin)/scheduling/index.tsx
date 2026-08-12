import { useAuth } from '@/auth/AuthProvider';
import { AdminSchedulingScreen } from '@/features/scheduling/AdminSchedulingScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminSchedulingRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require={['schedule.read', 'schedule.capacity.read']} mode="any">
      <AdminSchedulingScreen />
    </PermissionGate>
  );
}
