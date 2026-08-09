import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ProductionDetailScreen } from '@/features/production/ProductionDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminProductionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="production-order.read" mode="all">
      <ProductionDetailScreen orderId={String(id ?? '')} />
    </PermissionGate>
  );
}
