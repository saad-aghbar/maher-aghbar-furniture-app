import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { SupplierDetailScreen } from '@/features/purchasing/SupplierDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminSupplierDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="supplier.read" mode="all">
      <SupplierDetailScreen supplierId={String(id ?? '')} />
    </PermissionGate>
  );
}
