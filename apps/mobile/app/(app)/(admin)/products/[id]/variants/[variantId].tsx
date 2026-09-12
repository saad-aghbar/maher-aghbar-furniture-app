import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AdminVariantDetailScreen } from '@/features/catalog/AdminVariantDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProductVariantRoute() {
  const { user } = useAuth();
  const { id, variantId } = useLocalSearchParams<{ id: string; variantId: string }>();

  return (
    <PermissionGate user={user} require="catalog.manage" mode="all">
      <AdminVariantDetailScreen productId={String(id ?? '')} variantId={String(variantId ?? '')} />
    </PermissionGate>
  );
}
