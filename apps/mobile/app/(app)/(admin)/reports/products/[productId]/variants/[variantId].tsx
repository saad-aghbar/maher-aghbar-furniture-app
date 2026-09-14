import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { CostVariantProfileScreen } from '@/features/reports/CostVariantProfileScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReportsVariantProfileRoute() {
  const { user } = useAuth();
  const { productId, variantId } = useLocalSearchParams<{ productId: string; variantId: string }>();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <CostVariantProfileScreen
        productId={String(productId ?? '')}
        variantId={String(variantId ?? '')}
      />
    </PermissionGate>
  );
}
