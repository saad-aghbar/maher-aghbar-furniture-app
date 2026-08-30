import { useAuth } from '@/auth/AuthProvider';
import { DealerPaymentsScreen } from '@/features/account/DealerPaymentsScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerPaymentsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="payment.read" mode="all">
      <DealerPaymentsScreen />
    </PermissionGate>
  );
}
