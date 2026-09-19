import { useAuth } from '@/auth/AuthProvider';
import { ReportsOrdersDeskHost } from '@/features/reports/ReportsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsOrdersRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsOrdersDeskHost />
    </PermissionGate>
  );
}
