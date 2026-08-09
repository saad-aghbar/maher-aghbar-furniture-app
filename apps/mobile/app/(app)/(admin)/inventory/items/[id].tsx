import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { InventoryItemDetailScreen } from '@/features/inventory/InventoryItemDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInventoryItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.read" mode="all">
      <InventoryItemDetailScreen itemId={String(id ?? '')} />
    </PermissionGate>
  );
}
