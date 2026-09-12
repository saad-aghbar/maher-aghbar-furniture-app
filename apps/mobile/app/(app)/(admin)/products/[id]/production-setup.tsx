import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { ProductionSetupScreen } from '@/features/workflow/ProductionSetupScreen';

export default function ProductProductionSetupRoute() {
  const { user } = useAuth();
  const { id, variantId } = useLocalSearchParams<{ id: string; variantId?: string }>();
  const productId = String(id ?? '');

  return (
    <PermissionGate user={user} require="catalog.manage" mode="all">
      <ProductionSetupScreen
        productId={productId}
        variantId={variantId ? String(variantId) : null}
        backFallback={`/(app)/(admin)/products/${productId}`}
      />
    </PermissionGate>
  );
}
