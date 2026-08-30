import { useAuth } from '@/auth/AuthProvider';
import { InventoryFinishedOrderScreen } from '@/features/inventory/InventoryFinishedOrderScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInventoryFinishedOrderRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.read" mode="all">
      <InventoryFinishedOrderScreen />
    </PermissionGate>
  );
}
