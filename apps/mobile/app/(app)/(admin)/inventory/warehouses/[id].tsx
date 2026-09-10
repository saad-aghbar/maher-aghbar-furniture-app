import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { InventoryWarehouseDetailScreen } from '@/features/inventory/InventoryWarehouseDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInventoryWarehouseDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['warehouse.read', 'warehouse.manage', 'inventory.read', 'inventory.receive']}
      mode="any"
    >
      <InventoryWarehouseDetailScreen warehouseId={String(id ?? '')} />
    </PermissionGate>
  );
}
