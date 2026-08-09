import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { CreateReturnScreen } from '@/features/returns/CreateReturnScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerCreateReturnRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <CreateReturnScreen
        afterCreateHref={(id) => `/(app)/(customer)/returns/${id}` as Href}
      />
    </PermissionGate>
  );
}
