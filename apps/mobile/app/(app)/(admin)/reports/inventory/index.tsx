import { useAuth } from '@/auth/AuthProvider';
import { ReportsInventoryDeskHost } from '@/features/reports/ReportsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsInventoryRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsInventoryDeskHost />
    </PermissionGate>
  );
}
