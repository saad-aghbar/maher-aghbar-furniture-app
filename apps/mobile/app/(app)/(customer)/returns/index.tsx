import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ReturnsListScreen } from '@/features/returns/ReturnsListScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerReturnsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require={['return.read', 'sales-order.read']} mode="any">
      <ReturnsListScreen
        detailHref={(id) => `/(app)/(customer)/returns/${id}` as Href}
        createHref={'/(app)/(customer)/returns/create' as Href}
        canCreate
        backFallback={'/(app)/(customer)/(tabs)/account' as Href}
      />
    </PermissionGate>
  );
}
