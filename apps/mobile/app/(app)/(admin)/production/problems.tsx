import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { ProductionProblemsScreen } from '@/features/production/ProductionProblemsScreen';

export default function AdminProductionProblemsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-task.update-any" mode="all">
      <ProductionProblemsScreen />
    </PermissionGate>
  );
}
