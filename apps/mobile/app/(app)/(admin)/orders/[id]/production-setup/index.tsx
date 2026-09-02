import type { Href } from 'expo-router';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Legacy entry: Production Plan is the only Preparing workspace.
 * Line editors under /production-setup/lines redirect to ?lineId= on the plan.
 */
export default function OrderProductionSetupRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const soId = String(id ?? '');

  return (
    <PermissionGate user={user} require="production.setup.view" mode="all">
      <Redirect href={`/(app)/(admin)/orders/${soId}/production-plan` as Href} />
    </PermissionGate>
  );
}
