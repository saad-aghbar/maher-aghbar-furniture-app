import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { CostOrderDossierScreen } from '@/features/reports/CostOrderDossierScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function OrderCostDossierRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PermissionGate user={user} require="inventory.cost.read">
      <CostOrderDossierScreen id={String(id ?? '')} />
    </PermissionGate>
  );
}
