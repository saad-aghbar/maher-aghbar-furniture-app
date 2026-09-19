import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ReturnsDeskHost } from '@/features/returns/ReturnsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerReturnsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require={['return.read', 'sales-order.read']} mode="any">
      <ReturnsDeskHost
        compactHref={(id) => `/(app)/(customer)/returns/${id}` as Href}
        backFallback={'/(app)/(customer)/(tabs)/account' as Href}
        adminControls={false}
        dealerFacing
        canCreate
        createHref={'/(app)/(customer)/returns/create' as Href}
      />
    </PermissionGate>
  );
}
