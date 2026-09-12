import { useLocalSearchParams, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerReceiptDetailScreen } from '@/features/dealer-receipts/DealerReceiptDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerDeliveryDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <DealerReceiptDetailScreen
        salesOrderId={String(id ?? '')}
        backFallback={'/(app)/(customer)/deliveries' as Href}
      />
    </PermissionGate>
  );
}
