import { useAuth } from '@/auth/AuthProvider';
import { ProductionOverviewScreen } from '@/features/production/ProductionOverviewScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProduction() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['production-order.read', 'production-task.read']}
      mode="any"
    >
      <ProductionOverviewScreen />
    </PermissionGate>
  );
}
