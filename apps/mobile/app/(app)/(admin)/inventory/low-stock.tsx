import { useAuth } from '@/auth/AuthProvider';
import { InventoryLowStockScreen } from '@/features/inventory/InventoryLowStockScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInventoryLowStockRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.read" mode="all">
      <InventoryLowStockScreen />
    </PermissionGate>
  );
}
