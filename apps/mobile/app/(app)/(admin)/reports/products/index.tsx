import { useAuth } from '@/auth/AuthProvider';
import { ReportsProductsScreen } from '@/features/reports/ReportsProductsScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsProductsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsProductsScreen />
    </PermissionGate>
  );
}
