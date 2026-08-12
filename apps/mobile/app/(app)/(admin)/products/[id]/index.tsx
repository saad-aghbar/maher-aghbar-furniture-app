import { useLocalSearchParams } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AdminProductDetailScreen } from '@/features/catalog/AdminProductDetailScreen';
import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProductDetailRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = String(id ?? '');
  const canManage = can(user, 'catalog.manage');

  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      {canManage ? (
        <AdminProductDetailScreen productId={productId} />
      ) : (
        <ProductDetailScreen productId={productId} variant="admin" />
      )}
    </PermissionGate>
  );
}
