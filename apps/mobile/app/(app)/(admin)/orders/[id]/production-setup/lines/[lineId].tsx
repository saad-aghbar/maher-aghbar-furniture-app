import type { Href } from 'expo-router';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Legacy line editor route — redirect into canonical Production Plan with line sheet.
 */
export default function OrderProductionSetupLineRoute() {
  const { user } = useAuth();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const soId = String(id ?? '');
  const lid = String(lineId ?? '');
  const href =
    `/(app)/(admin)/orders/${soId}/production-plan?lineId=${encodeURIComponent(lid)}` as Href;

  return (
    <PermissionGate user={user} require="production.setup.view" mode="all">
      <Redirect href={href} />
    </PermissionGate>
  );
}
