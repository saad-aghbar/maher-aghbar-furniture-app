import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { CostInventoryItemScreen } from '@/features/reports/CostInventoryItemScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsInventoryItemRoute() {
  const { user } = useAuth();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <CostInventoryItemScreen itemId={String(itemId ?? '')} />
    </PermissionGate>
  );
}
