import { CatalogScreen } from '@/features/catalog/CatalogScreen';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerCatalog() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      <CatalogScreen variant="dealer" />
    </PermissionGate>
  );
}
