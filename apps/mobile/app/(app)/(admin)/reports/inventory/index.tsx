import { useAuth } from '@/auth/AuthProvider';
import { ReportsInventoryScreen } from '@/features/reports/ReportsInventoryScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsInventoryRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsInventoryScreen />
    </PermissionGate>
  );
}
