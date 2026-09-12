import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerReceiptsListScreen } from '@/features/dealer-receipts/DealerReceiptsListScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerDeliveriesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <DealerReceiptsListScreen
        detailHref={(id) => `/(app)/(customer)/deliveries/${id}` as Href}
        backFallback={'/(app)/(customer)/(tabs)' as Href}
      />
    </PermissionGate>
  );
}
