import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { OrderProductionSetupHomeScreen } from '@/features/sales-orders/production-setup/OrderProductionSetupHomeScreen';

export default function OrderProductionSetupRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PermissionGate user={user} require="production.setup.view" mode="all">
      <OrderProductionSetupHomeScreen salesOrderId={String(id ?? '')} />
    </PermissionGate>
  );
}
