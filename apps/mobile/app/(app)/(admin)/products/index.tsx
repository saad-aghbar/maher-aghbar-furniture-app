import { useAuth } from '@/auth/AuthProvider';
import { ProductsDeskHost } from '@/features/catalog/ProductsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProductsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      <ProductsDeskHost />
    </PermissionGate>
  );
}
