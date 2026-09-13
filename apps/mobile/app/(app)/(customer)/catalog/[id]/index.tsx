import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerProductDetailRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      <ProductDetailScreen productId={String(id ?? '')} variant="dealer" />
    </PermissionGate>
  );
}
