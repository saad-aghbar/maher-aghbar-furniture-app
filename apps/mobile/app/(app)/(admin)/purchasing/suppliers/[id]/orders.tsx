import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { SupplierOrdersScreen } from '@/features/purchasing/SupplierOrdersScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminSupplierOrdersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="purchase-order.read" mode="all">
      <SupplierOrdersScreen supplierId={String(id ?? '')} />
    </PermissionGate>
  );
}
