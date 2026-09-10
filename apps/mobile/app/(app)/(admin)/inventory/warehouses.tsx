import { useAuth } from '@/auth/AuthProvider';
import { InventoryWarehousesScreen } from '@/features/inventory/InventoryWarehousesScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInventoryWarehousesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['warehouse.read', 'warehouse.manage', 'inventory.read']}
      mode="any"
    >
      <InventoryWarehousesScreen />
    </PermissionGate>
  );
}
