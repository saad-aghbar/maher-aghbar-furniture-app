import { DealerCatalogDeskHost } from '@/features/catalog/DealerCatalogDeskHost';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerCatalog() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      <DealerCatalogDeskHost />
    </PermissionGate>
  );
}
