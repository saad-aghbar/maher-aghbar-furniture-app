import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerQuotationsListScreen } from '@/features/quotations/DealerQuotationsListScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerQuotationsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="quotation.read" mode="all">
      <DealerQuotationsListScreen
        detailHref={(id) => `/(app)/(customer)/quotations/${id}` as Href}
        backFallback={'/(app)/(customer)/(tabs)/orders' as Href}
      />
    </PermissionGate>
  );
}
