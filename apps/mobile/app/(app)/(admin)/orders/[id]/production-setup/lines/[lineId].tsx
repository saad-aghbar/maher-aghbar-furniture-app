import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { OrderProductionSetupLineScreen } from '@/features/sales-orders/production-setup/OrderProductionSetupLineScreen';

export default function OrderProductionSetupLineRoute() {
  const { user } = useAuth();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();

  return (
    <PermissionGate user={user} require="production.setup.view" mode="all">
      <OrderProductionSetupLineScreen
        salesOrderId={String(id ?? '')}
        lineId={String(lineId ?? '')}
      />
    </PermissionGate>
  );
}
