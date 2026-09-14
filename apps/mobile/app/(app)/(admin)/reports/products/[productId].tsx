import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { CostProductProfileScreen } from '@/features/reports/CostProductProfileScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsProductProfileRoute() {
  const { user } = useAuth();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <CostProductProfileScreen productId={String(productId ?? '')} />
    </PermissionGate>
  );
}
