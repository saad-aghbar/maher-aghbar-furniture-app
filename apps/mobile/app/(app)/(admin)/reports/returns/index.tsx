import { useAuth } from '@/auth/AuthProvider';
import { ReportsReturnsDeskHost } from '@/features/reports/ReportsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsReturnsDeskRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <ReportsReturnsDeskHost />
    </PermissionGate>
  );
}
