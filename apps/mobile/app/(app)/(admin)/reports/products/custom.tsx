import { useAuth } from '@/auth/AuthProvider';
import { CostCustomWorkScreen } from '@/features/reports/CostCustomWorkScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsCustomWorkRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <CostCustomWorkScreen />
    </PermissionGate>
  );
}
