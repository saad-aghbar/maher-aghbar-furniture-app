import { useAuth } from '@/auth/AuthProvider';
import { InventorySemiOrderScreen } from '@/features/inventory/InventorySemiOrderScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInventorySemiOrderRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.read" mode="all">
      <InventorySemiOrderScreen />
    </PermissionGate>
  );
}
