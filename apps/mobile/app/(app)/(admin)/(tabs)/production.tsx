import { useAuth } from '@/auth/AuthProvider';
import { ProductionDeskHost } from '@/features/production/ProductionDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProduction() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['production-order.read', 'production-task.read']}
      mode="any"
    >
      <ProductionDeskHost />
    </PermissionGate>
  );
}
