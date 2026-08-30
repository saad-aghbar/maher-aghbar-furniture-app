import { useAuth } from '@/auth/AuthProvider';
import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminReportsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['report.sales.read', 'report.production.read', 'report.financial.read']}
      mode="any"
    >
      <ReportsScreen />
    </PermissionGate>
  );
}
