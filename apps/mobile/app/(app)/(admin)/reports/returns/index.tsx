import { useAuth } from '@/auth/AuthProvider';
import { ReportsReturnsScreen } from '@/features/reports/ReportsReturnsScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsReturnsDeskRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsReturnsScreen />
    </PermissionGate>
  );
}
