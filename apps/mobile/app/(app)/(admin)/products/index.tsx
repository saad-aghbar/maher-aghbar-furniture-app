import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { CatalogScreen } from '@/features/catalog/CatalogScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProductsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      <CatalogScreen
        variant="admin"
        titleKey="mobile.adminHome.navProducts"
        productDetailHref={(id) => `/(app)/(admin)/products/${id}` as Href}
        showBack
        backFallback={'/(app)/(admin)/(tabs)' as Href}
        showCreateProduct
      />
    </PermissionGate>
  );
}
