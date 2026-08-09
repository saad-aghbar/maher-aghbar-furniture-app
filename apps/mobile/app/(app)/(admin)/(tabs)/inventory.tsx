import { useAuth } from '@/auth/AuthProvider';
import { InventoryGroupsScreen } from '@/features/inventory/InventoryGroupsScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInventory() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['inventory.read', 'inventory.count', 'inventory.receive', 'purchase-order.read']}
      mode="any"
    >
      <InventoryGroupsScreen />
    </PermissionGate>
  );
}
