import { useAuth } from '@/auth/AuthProvider';
import { ReportsProductsDeskHost } from '@/features/reports/ReportsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsProductsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsProductsDeskHost />
    </PermissionGate>
  );
}
