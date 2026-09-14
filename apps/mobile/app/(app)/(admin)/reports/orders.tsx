import { useAuth } from '@/auth/AuthProvider';
import { ReportsOrdersScreen } from '@/features/reports/ReportsOrdersScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsOrdersRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsOrdersScreen />
    </PermissionGate>
  );
}
