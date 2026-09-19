import { useAuth } from '@/auth/AuthProvider';
import { DealerReceiptsDeskHost } from '@/features/dealer-receipts/DealerReceiptsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerDeliveriesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <DealerReceiptsDeskHost />
    </PermissionGate>
  );
}
